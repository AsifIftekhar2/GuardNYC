from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
import json
import re

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
JWT_ALGORITHM = "HS256"

# Google OAuth Config
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get('GOOGLE_REDIRECT_URI', 'https://app-launch-241.preview.emergentagent.com/api/google/callback')
GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']

# App
app = FastAPI(title="Agentic Safeguard API")
api_router = APIRouter(prefix="/api")

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== MODELS ====================

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChatMessageRequest(BaseModel):
    message: str

class SafetyAnalyzeRequest(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = "Unknown location"
    time_of_day: Optional[str] = ""

class PlanEventRequest(BaseModel):
    title: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    start_time: str
    end_time: Optional[str] = None
    notes: Optional[str] = None

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "name": req.name,
        "email": email,
        "password_hash": hash_password(req.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    return {
        "user": {"id": user_id, "name": req.name, "email": email, "role": "user"},
        "access_token": access_token,
        "refresh_token": refresh_token
    }

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    return {
        "user": {"id": user_id, "name": user["name"], "email": email, "role": user.get("role", "user")},
        "access_token": access_token,
        "refresh_token": refresh_token
    }

@api_router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"user": user}

@api_router.post("/auth/logout")
async def logout():
    return {"message": "Logged out successfully"}

# ==================== SHOOTING DATA ====================

NYC_SODA_URL = "https://data.cityofnewyork.us/resource/5ucz-vwe8.json"

async def sync_shooting_data():
    """Fetch shooting data from NYC OpenData SODA API and cache in MongoDB"""
    logger.info("Syncing shooting data from NYC OpenData...")
    async with httpx.AsyncClient() as http_client:
        params = {
            "$limit": 5000,
            "$order": "occur_date DESC",
        }
        response = await http_client.get(NYC_SODA_URL, params=params, timeout=60)
        if response.status_code != 200:
            logger.error(f"Failed to fetch shooting data: {response.status_code} - {response.text[:200]}")
            raise HTTPException(status_code=500, detail="Failed to fetch shooting data")

        data = response.json()
        records = []
        for item in data:
            try:
                lat_str = item.get("latitude", "")
                lon_str = item.get("longitude", "")
                if not lat_str or not lon_str:
                    continue
                lat = float(lat_str)
                lon = float(lon_str)
                if lat == 0 or lon == 0:
                    continue
                occur_date = item.get("occur_date", "")
                year = None
                if occur_date:
                    try:
                        year = int(occur_date[:4])
                    except (ValueError, IndexError):
                        pass
                record = {
                    "incident_key": item.get("incident_key", ""),
                    "occur_date": occur_date,
                    "occur_time": item.get("occur_time", ""),
                    "boro": item.get("boro", ""),
                    "precinct": int(item.get("precinct", 0)) if item.get("precinct") else 0,
                    "latitude": lat,
                    "longitude": lon,
                    "is_murder": str(item.get("statistical_murder_flag", "false")).lower() == "true",
                    "location_desc": item.get("location_desc", ""),
                    "loc_of_occur_desc": item.get("loc_of_occur_desc", ""),
                    "vic_age_group": item.get("vic_age_group", ""),
                    "vic_sex": item.get("vic_sex", ""),
                    "vic_race": item.get("vic_race", ""),
                    "year": year
                }
                records.append(record)
            except (ValueError, TypeError):
                continue

        if records:
            await db.shooting_data.delete_many({})
            await db.shooting_data.insert_many(records)
            logger.info(f"Synced {len(records)} shooting records")
        return len(records)

@api_router.get("/shootings")
async def get_shootings(boro: Optional[str] = None, year: Optional[int] = None, limit: int = 3000):
    count = await db.shooting_data.count_documents({})
    if count == 0:
        try:
            await sync_shooting_data()
        except Exception as e:
            logger.error(f"Auto-sync failed: {e}")
            return {"shootings": [], "count": 0}

    query = {}
    if boro:
        query["boro"] = boro.upper()
    if year:
        query["year"] = year

    shootings = await db.shooting_data.find(
        query, {"_id": 0}
    ).sort("occur_date", -1).limit(limit).to_list(limit)
    return {"shootings": shootings, "count": len(shootings)}

@api_router.post("/shootings/sync")
async def trigger_sync():
    count = await sync_shooting_data()
    return {"message": f"Synced {count} shooting records", "count": count}

@api_router.get("/shootings/heatmap")
async def get_heatmap_data(limit: int = 5000):
    """Get lightweight heatmap data (just lat/lng)"""
    count = await db.shooting_data.count_documents({})
    if count == 0:
        try:
            await sync_shooting_data()
        except Exception:
            return {"points": []}

    shootings = await db.shooting_data.find(
        {}, {"_id": 0, "latitude": 1, "longitude": 1, "is_murder": 1}
    ).limit(limit).to_list(limit)
    points = [[s["latitude"], s["longitude"], 1.0 if s.get("is_murder") else 0.5] for s in shootings]
    return {"points": points, "count": len(points)}

# ==================== SAFETY ANALYSIS ====================

async def run_safety_analysis(latitude: float, longitude: float, location_name: str, time_of_day: str = "") -> dict:
    """Core safety analysis function - reusable"""
    radius = 0.01  # ~1km
    nearby = await db.shooting_data.find({
        "latitude": {"$gte": latitude - radius, "$lte": latitude + radius},
        "longitude": {"$gte": longitude - radius, "$lte": longitude + radius}
    }, {"_id": 0}).to_list(500)

    total_nearby = len(nearby)
    murders_nearby = sum(1 for s in nearby if s.get("is_murder"))

    time_counts = {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
    for s in nearby:
        t = s.get("occur_time", "")
        if t:
            try:
                hour = int(t.split(":")[0])
                if 6 <= hour < 12:
                    time_counts["morning"] += 1
                elif 12 <= hour < 17:
                    time_counts["afternoon"] += 1
                elif 17 <= hour < 21:
                    time_counts["evening"] += 1
                else:
                    time_counts["night"] += 1
            except (ValueError, IndexError):
                pass

    boro_stats = {}
    for s in nearby:
        b = s.get("boro", "UNKNOWN")
        boro_stats[b] = boro_stats.get(b, 0) + 1

    prompt = f"""Analyze the safety of this NYC location based on shooting incident data:

Location: {location_name} (Lat: {latitude:.4f}, Lon: {longitude:.4f})
Time of visit: {time_of_day if time_of_day else 'Not specified'}

Shooting data within ~1km radius:
- Total incidents: {total_nearby}
- Fatal incidents: {murders_nearby}
- Borough breakdown: {json.dumps(boro_stats)}
- Time distribution: Morning({time_counts['morning']}), Afternoon({time_counts['afternoon']}), Evening({time_counts['evening']}), Night({time_counts['night']})

Recent incidents nearby: {json.dumps([{"desc": s.get("location_desc",""), "time": s.get("occur_time",""), "date": s.get("occur_date","")[:10] if s.get("occur_date") else ""} for s in nearby[:8]])}

Provide a JSON response with these exact keys:
- "rating": number 1-10 (10=safest)
- "risk_level": "LOW" or "MODERATE" or "HIGH" or "CRITICAL"
- "assessment": brief 2-3 sentence assessment
- "recommendations": array of 3-4 safety tips
- "best_times": when to visit
- "avoid_times": when to avoid

RESPOND ONLY WITH VALID JSON, no markdown."""

    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"safety-{uuid.uuid4()}",
            system_message="You are an expert NYC safety analyst. Provide accurate, data-driven safety assessments based on shooting incident data. Always respond in valid JSON format only."
        ).with_model("gemini", "gemini-3-flash-preview")

        response = await chat.send_message(UserMessage(text=prompt))

        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                analysis = {"rating": 5, "risk_level": "MODERATE", "assessment": response, "recommendations": [], "best_times": "Daytime", "avoid_times": "Late night"}
        except json.JSONDecodeError:
            analysis = {"rating": 5, "risk_level": "MODERATE", "assessment": response, "recommendations": [], "best_times": "Daytime", "avoid_times": "Late night"}

    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        if total_nearby == 0:
            rating, risk = 9, "LOW"
        elif total_nearby < 5:
            rating, risk = 7, "LOW"
        elif total_nearby < 20:
            rating, risk = 5, "MODERATE"
        elif total_nearby < 50:
            rating, risk = 3, "HIGH"
        else:
            rating, risk = 1, "CRITICAL"
        analysis = {
            "rating": rating,
            "risk_level": risk,
            "assessment": f"Based on {total_nearby} shooting incidents nearby, this area has a {risk.lower()} risk level.",
            "recommendations": ["Stay aware of your surroundings", "Avoid poorly lit areas at night", "Travel with companions when possible"],
            "best_times": "Daytime hours (8am-5pm)",
            "avoid_times": "Late night (11pm-5am)"
        }

    analysis["latitude"] = latitude
    analysis["longitude"] = longitude
    analysis["location_name"] = location_name
    analysis["incident_count"] = total_nearby
    analysis["analyzed_at"] = datetime.now(timezone.utc).isoformat()
    return analysis

@api_router.post("/safety/analyze")
async def analyze_safety(req: SafetyAnalyzeRequest, user=Depends(get_current_user)):
    analysis = await run_safety_analysis(req.latitude, req.longitude, req.location_name or "Unknown", req.time_of_day or "")
    return analysis

# ==================== AI CHAT ====================

@api_router.post("/chat")
async def chat_with_agent(req: ChatMessageRequest, user=Depends(get_current_user)):
    user_id = user["_id"]

    history = await db.chat_messages.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    history.reverse()

    context_messages = ""
    for msg in history:
        role = "User" if msg["role"] == "user" else "Agent"
        context_messages += f"{role}: {msg['content']}\n"

    system_msg = """You are the Agentic Safeguard AI, an expert NYC safety advisor powered by real NYPD shooting incident data (2006-present).

You help users:
1. Understand safety risks in NYC neighborhoods
2. Get safety ratings for specific locations
3. Plan safer routes and schedules
4. Learn about risk patterns (time of day, borough, seasonal trends)
5. Make informed decisions about where and when to go

Be helpful, factual, and reassuring. Focus on actionable advice. Don't cause unnecessary panic.
When locations are mentioned, reference shooting data patterns.
Keep responses concise but thorough - 2-4 paragraphs max."""

    prompt = f"""Previous conversation:
{context_messages}

User's message: {req.message}

Respond helpfully about NYC safety."""

    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"chat-{user_id}-{uuid.uuid4()}",
            system_message=system_msg
        ).with_model("gemini", "gemini-3-flash-preview")

        response = await chat.send_message(UserMessage(text=prompt))

        now = datetime.now(timezone.utc)
        await db.chat_messages.insert_many([
            {"user_id": user_id, "role": "user", "content": req.message, "created_at": now.isoformat()},
            {"user_id": user_id, "role": "assistant", "content": response, "created_at": (now + timedelta(milliseconds=1)).isoformat()}
        ])

        return {"response": response}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="AI agent temporarily unavailable. Please try again.")

@api_router.get("/chat/history")
async def get_chat_history(user=Depends(get_current_user)):
    user_id = user["_id"]
    messages = await db.chat_messages.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", 1).limit(100).to_list(100)

    for msg in messages:
        if isinstance(msg.get("created_at"), datetime):
            msg["created_at"] = msg["created_at"].isoformat()
    return {"messages": messages}

@api_router.delete("/chat/history")
async def clear_chat_history(user=Depends(get_current_user)):
    user_id = user["_id"]
    result = await db.chat_messages.delete_many({"user_id": user_id})
    return {"message": f"Cleared {result.deleted_count} messages"}

# ==================== PLANS / EVENTS ====================

@api_router.post("/plans")
async def create_plan(req: PlanEventRequest, user=Depends(get_current_user)):
    # If no coordinates, try to geocode
    lat = req.latitude
    lon = req.longitude
    if not lat or not lon:
        coords = await geocode_location(req.location_name)
        if coords:
            lat, lon = coords

    plan = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "title": req.title,
        "location_name": req.location_name,
        "latitude": lat,
        "longitude": lon,
        "start_time": req.start_time,
        "end_time": req.end_time,
        "notes": req.notes,
        "safety_analysis": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Auto-analyze if we have coordinates
    if lat and lon:
        try:
            analysis = await run_safety_analysis(lat, lon, req.location_name, req.start_time)
            plan["safety_analysis"] = analysis
        except Exception as e:
            logger.error(f"Auto-analysis failed: {e}")

    await db.plans.insert_one(plan)
    plan.pop("_id", None)
    return plan

@api_router.get("/plans")
async def get_plans(user=Depends(get_current_user)):
    plans = await db.plans.find(
        {"user_id": user["_id"]}, {"_id": 0}
    ).sort("start_time", 1).to_list(100)
    return {"plans": plans}

@api_router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user=Depends(get_current_user)):
    result = await db.plans.delete_one({"id": plan_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"message": "Plan deleted"}

@api_router.post("/plans/{plan_id}/analyze")
async def analyze_plan(plan_id: str, user=Depends(get_current_user)):
    plan = await db.plans.find_one({"id": plan_id, "user_id": user["_id"]})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if not plan.get("latitude") or not plan.get("longitude"):
        coords = await geocode_location(plan["location_name"])
        if coords:
            await db.plans.update_one({"id": plan_id}, {"$set": {"latitude": coords[0], "longitude": coords[1]}})
            plan["latitude"], plan["longitude"] = coords
        else:
            raise HTTPException(status_code=400, detail="Could not determine location coordinates")

    analysis = await run_safety_analysis(plan["latitude"], plan["longitude"], plan["location_name"], plan.get("start_time", ""))
    await db.plans.update_one({"id": plan_id}, {"$set": {"safety_analysis": analysis}})

    plan["safety_analysis"] = analysis
    plan.pop("_id", None)
    return plan

async def geocode_location(location_name: str):
    """Geocode a location name to coordinates using Nominatim"""
    if not location_name or location_name.strip() == "":
        return None
    
    try:
        # Clean up location name
        location = location_name.strip()
        
        # If location doesn't mention NYC, try multiple search strategies
        search_terms = []
        if 'new york' not in location.lower() and 'nyc' not in location.lower() and 'ny' not in location.lower():
            search_terms.append(f"{location}, New York City, NY")
            search_terms.append(f"{location}, NYC")
            search_terms.append(f"{location}, New York, USA")
        else:
            search_terms.append(location)
        
        async with httpx.AsyncClient() as http_client:
            for search_term in search_terms:
                params = {
                    "q": search_term,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "us"
                }
                response = await http_client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params=params,
                    headers={"User-Agent": "AgenticSafeguard/1.0"},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
                        # Verify it's in NYC area (rough bounds)
                        # NYC bounds: lat 40.4-40.95, lon -74.3--73.7
                        if 40.4 <= lat <= 40.95 and -74.3 <= lon <= -73.7:
                            logger.info(f"Geocoded '{location_name}' to ({lat}, {lon})")
                            return (lat, lon)
                        else:
                            logger.warning(f"'{search_term}' not in NYC area: ({lat}, {lon})")
                            continue
    except Exception as e:
        logger.error(f"Geocoding error for '{location_name}': {e}")
    
    logger.warning(f"Could not geocode location: '{location_name}'")
    return None

# ==================== STATS ====================

@api_router.get("/stats/boroughs")
async def get_borough_stats():
    pipeline = [
        {"$group": {
            "_id": "$boro",
            "total": {"$sum": 1},
            "murders": {"$sum": {"$cond": [{"$eq": ["$is_murder", True]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}}
    ]
    stats = await db.shooting_data.aggregate(pipeline).to_list(10)
    return {"stats": [{"boro": s["_id"], "total": s["total"], "murders": s["murders"]} for s in stats]}

@api_router.get("/stats/time-distribution")
async def get_time_distribution():
    all_data = await db.shooting_data.find({}, {"_id": 0, "occur_time": 1}).to_list(10000)
    time_dist = {"00-06": 0, "06-12": 0, "12-18": 0, "18-24": 0}
    for d in all_data:
        t = d.get("occur_time", "")
        if t:
            try:
                hour = int(t.split(":")[0])
                if hour < 6:
                    time_dist["00-06"] += 1
                elif hour < 12:
                    time_dist["06-12"] += 1
                elif hour < 18:
                    time_dist["12-18"] += 1
                else:
                    time_dist["18-24"] += 1
            except (ValueError, IndexError):
                pass
    return {"distribution": time_dist}

@api_router.get("/stats/yearly")
async def get_yearly_stats():
    pipeline = [
        {"$match": {"year": {"$ne": None}}},
        {"$group": {"_id": "$year", "total": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": 10}
    ]
    stats = await db.shooting_data.aggregate(pipeline).to_list(10)
    return {"stats": [{"year": s["_id"], "total": s["total"]} for s in stats]}

@api_router.get("/geocode")
async def geocode(q: str):
    coords = await geocode_location(q)
    if coords:
        return {"latitude": coords[0], "longitude": coords[1], "query": q}
    raise HTTPException(status_code=404, detail="Location not found")

# ==================== GOOGLE CALENDAR INTEGRATION ====================

async def get_google_credentials(user_id: str):
    """Get and refresh Google credentials for a user"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("google_tokens"):
        return None
    
    tokens = user["google_tokens"]
    creds = Credentials(
        token=tokens.get("access_token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=GOOGLE_SCOPES
    )
    
    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Update tokens in database
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "google_tokens.access_token": creds.token,
                    "google_tokens.expiry": creds.expiry.isoformat() if creds.expiry else None
                }}
            )
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return None
    
    return creds

@api_router.get("/google/auth")
async def google_auth(user=Depends(get_current_user)):
    """Initiate Google OAuth flow"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    # Build authorization URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        "response_type=code&"
        f"scope={' '.join(GOOGLE_SCOPES)}&"
        "access_type=offline&"
        "prompt=consent&"
        f"state={user['_id']}"  # Pass user ID as state
    )
    
    return {"authorization_url": auth_url}

@api_router.get("/google/callback")
async def google_callback(code: str, state: str):
    """Handle Google OAuth callback"""
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'code': code,
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uri': GOOGLE_REDIRECT_URI,
                    'grant_type': 'authorization_code'
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
            tokens = token_response.json()
            
            # Save tokens to user (state contains user_id)
            user_id = state
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "google_tokens": tokens,
                    "google_connected_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Trigger initial sync
            try:
                await sync_google_calendar(user_id)
            except Exception as e:
                logger.error(f"Initial sync failed: {e}")
            
            # Redirect back to app with success
            return RedirectResponse(
                url=f"/?google_calendar=connected",
                status_code=302
            )
    except Exception as e:
        logger.error(f"Google callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/google/status")
async def google_calendar_status(user=Depends(get_current_user)):
    """Check if user has connected Google Calendar"""
    user_id = user["_id"]
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    
    connected = bool(user_doc.get("google_tokens"))
    last_sync = user_doc.get("google_last_sync")
    
    return {
        "connected": connected,
        "last_sync": last_sync,
        "connected_at": user_doc.get("google_connected_at")
    }

@api_router.post("/google/sync")
async def trigger_google_sync(user=Depends(get_current_user)):
    """Manually trigger Google Calendar sync"""
    user_id = user["_id"]
    synced_count = await sync_google_calendar(user_id)
    return {"message": f"Synced {synced_count} events from Google Calendar", "count": synced_count}

@api_router.post("/google/disconnect")
async def disconnect_google_calendar(user=Depends(get_current_user)):
    """Disconnect Google Calendar and remove synced events"""
    user_id = user["_id"]
    
    # Remove Google tokens
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$unset": {"google_tokens": "", "google_connected_at": "", "google_last_sync": ""}}
    )
    
    # Delete synced plans
    result = await db.plans.delete_many({
        "user_id": user_id,
        "google_event_id": {"$exists": True}
    })
    
    return {"message": f"Disconnected and removed {result.deleted_count} synced events"}

async def sync_google_calendar(user_id: str):
    """Sync events from Google Calendar"""
    creds = await get_google_credentials(user_id)
    if not creds:
        raise HTTPException(status_code=401, detail="Google Calendar not connected")
    
    try:
        service = build('calendar', 'v3', credentials=creds)
        
        # Get events for next 30 days
        now = datetime.now(timezone.utc)
        time_min = now.isoformat()
        time_max = (now + timedelta(days=30)).isoformat()
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            maxResults=50,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        synced_count = 0
        
        for event in events:
            event_id = event['id']
            
            # Extract location
            location_name = event.get('location', 'Unknown location')
            
            # Extract time
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            
            # Check if we already have this event
            existing = await db.plans.find_one({
                "user_id": user_id,
                "google_event_id": event_id
            })
            
            # Geocode location for NYC events
            lat, lon = None, None
            if location_name and location_name != 'Unknown location':
                coords = await geocode_location(location_name)
                if coords:
                    lat, lon = coords
            
            plan_data = {
                "user_id": user_id,
                "google_event_id": event_id,
                "title": event.get('summary', 'Untitled Event'),
                "location_name": location_name,
                "latitude": lat,
                "longitude": lon,
                "start_time": start,
                "end_time": end,
                "notes": event.get('description', ''),
                "safety_analysis": None,
                "synced_from_google": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_synced": datetime.now(timezone.utc).isoformat()
            }
            
            # Auto-analyze if we have coordinates and it's in NYC
            if lat and lon:
                try:
                    analysis = await run_safety_analysis(lat, lon, location_name, start)
                    plan_data["safety_analysis"] = analysis
                except Exception as e:
                    logger.error(f"Auto-analysis failed for {location_name}: {e}")
            
            if existing:
                # Update existing
                await db.plans.update_one(
                    {"_id": existing["_id"]},
                    {"$set": plan_data}
                )
            else:
                # Create new
                plan_data["id"] = str(uuid.uuid4())
                await db.plans.insert_one(plan_data)
            
            synced_count += 1
        
        # Update last sync time
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"google_last_sync": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"Synced {synced_count} Google Calendar events for user {user_id}")
        return synced_count
        
    except Exception as e:
        logger.error(f"Google Calendar sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.shooting_data.create_index([("latitude", 1), ("longitude", 1)])
    await db.shooting_data.create_index("boro")
    await db.shooting_data.create_index("year")
    await db.chat_messages.create_index([("user_id", 1), ("created_at", -1)])
    await db.plans.create_index([("user_id", 1), ("start_time", 1)])
    logger.info("Database indexes created")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

    # Sync shooting data if empty
    try:
        count = await db.shooting_data.count_documents({})
        if count == 0:
            logger.info("No shooting data found, syncing from NYC OpenData...")
            await sync_shooting_data()
    except Exception as e:
        logger.error(f"Failed to sync shooting data on startup: {e}")

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
