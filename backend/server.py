from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
import os, logging, uuid, bcrypt, jwt, httpx, json, re, base64

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
JWT_ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

PREMIUM_PRICE = 9.99
FREE_ANALYSES_PER_DAY = 5

app = FastAPI(title="Agentic Safeguard API")
api_router = APIRouter(prefix="/api")

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=24), "type": "access"}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, JWT_SECRET, algorithm=JWT_ALGORITHM)

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
        user.pop("google_tokens", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_analysis_limit(user: dict) -> bool:
    if user.get("subscription_tier", "free") == "premium":
        return True
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    count = await db.analysis_log.count_documents({"user_id": user["_id"], "created_at": {"$gte": today_start}})
    return count < FREE_ANALYSES_PER_DAY

async def log_analysis(user_id: str):
    await db.analysis_log.insert_one({"user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})

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

class ReportRequest(BaseModel):
    title: str
    description: str
    category: str
    latitude: float
    longitude: float
    location_name: Optional[str] = ""
    photo: Optional[str] = None

class VoteRequest(BaseModel):
    vote: int  # 1 or -1

class CheckoutRequest(BaseModel):
    origin_url: str

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "name": req.name, "email": email,
        "password_hash": hash_password(req.password),
        "role": "user", "subscription_tier": "free",
        "google_calendar_connected": False,
        "unread_notifications": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    return {
        "user": {"id": user_id, "name": req.name, "email": email, "role": "user", "subscription_tier": "free", "google_calendar_connected": False, "unread_notifications": 0},
        "access_token": create_access_token(user_id, email),
        "refresh_token": create_refresh_token(user_id)
    }

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    return {
        "user": {"id": user_id, "name": user["name"], "email": email, "role": user.get("role", "user"),
                 "subscription_tier": user.get("subscription_tier", "free"),
                 "google_calendar_connected": user.get("google_calendar_connected", False),
                 "unread_notifications": user.get("unread_notifications", 0)},
        "access_token": create_access_token(user_id, email),
        "refresh_token": create_refresh_token(user_id)
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
    logger.info("Syncing shooting data from NYC OpenData...")
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(NYC_SODA_URL, params={"$limit": 5000, "$order": "occur_date DESC"}, timeout=60)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch shooting data")
        data = response.json()
        records = []
        for item in data:
            try:
                lat_str, lon_str = item.get("latitude", ""), item.get("longitude", "")
                if not lat_str or not lon_str:
                    continue
                lat, lon = float(lat_str), float(lon_str)
                if lat == 0 or lon == 0:
                    continue
                occur_date = item.get("occur_date", "")
                year = int(occur_date[:4]) if occur_date else None
                records.append({
                    "incident_key": item.get("incident_key", ""), "occur_date": occur_date,
                    "occur_time": item.get("occur_time", ""), "boro": item.get("boro", ""),
                    "precinct": int(item.get("precinct", 0)) if item.get("precinct") else 0,
                    "latitude": lat, "longitude": lon,
                    "is_murder": str(item.get("statistical_murder_flag", "false")).lower() == "true",
                    "location_desc": item.get("location_desc", ""),
                    "loc_of_occur_desc": item.get("loc_of_occur_desc", ""),
                    "vic_age_group": item.get("vic_age_group", ""),
                    "vic_sex": item.get("vic_sex", ""), "vic_race": item.get("vic_race", ""),
                    "year": year
                })
            except (ValueError, TypeError):
                continue
        if records:
            await db.shooting_data.delete_many({})
            await db.shooting_data.insert_many(records)
            logger.info(f"Synced {len(records)} shooting records")
        return len(records)

@api_router.get("/shootings")
async def get_shootings(boro: Optional[str] = None, year: Optional[int] = None, limit: int = 3000):
    if await db.shooting_data.count_documents({}) == 0:
        try:
            await sync_shooting_data()
        except Exception:
            return {"shootings": [], "count": 0}
    query = {}
    if boro:
        query["boro"] = boro.upper()
    if year:
        query["year"] = year
    shootings = await db.shooting_data.find(query, {"_id": 0}).sort("occur_date", -1).limit(limit).to_list(limit)
    return {"shootings": shootings, "count": len(shootings)}

@api_router.post("/shootings/sync")
async def trigger_sync():
    count = await sync_shooting_data()
    return {"message": f"Synced {count} shooting records", "count": count}

@api_router.get("/shootings/heatmap")
async def get_heatmap_data(limit: int = 5000):
    if await db.shooting_data.count_documents({}) == 0:
        try:
            await sync_shooting_data()
        except Exception:
            return {"points": []}
    shootings = await db.shooting_data.find({}, {"_id": 0, "latitude": 1, "longitude": 1, "is_murder": 1}).limit(limit).to_list(limit)
    points = [[s["latitude"], s["longitude"], 1.0 if s.get("is_murder") else 0.5] for s in shootings]
    return {"points": points, "count": len(points)}

# ==================== SAFETY ANALYSIS ====================

async def run_safety_analysis(latitude: float, longitude: float, location_name: str, time_of_day: str = "") -> dict:
    radius = 0.01
    nearby = await db.shooting_data.find({
        "latitude": {"$gte": latitude - radius, "$lte": latitude + radius},
        "longitude": {"$gte": longitude - radius, "$lte": longitude + radius}
    }, {"_id": 0}).to_list(500)
    total_nearby = len(nearby)
    murders_nearby = sum(1 for s in nearby if s.get("is_murder"))
    time_counts = {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
    boro_stats = {}
    for s in nearby:
        b = s.get("boro", "UNKNOWN")
        boro_stats[b] = boro_stats.get(b, 0) + 1
        t = s.get("occur_time", "")
        if t:
            try:
                hour = int(t.split(":")[0])
                if 6 <= hour < 12: time_counts["morning"] += 1
                elif 12 <= hour < 17: time_counts["afternoon"] += 1
                elif 17 <= hour < 21: time_counts["evening"] += 1
                else: time_counts["night"] += 1
            except (ValueError, IndexError):
                pass

    # Also check community reports nearby
    community_nearby = await db.community_reports.count_documents({
        "latitude": {"$gte": latitude - radius, "$lte": latitude + radius},
        "longitude": {"$gte": longitude - radius, "$lte": longitude + radius},
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}
    })

    prompt = f"""Analyze the safety of this NYC location based on shooting incident data:
Location: {location_name} (Lat: {latitude:.4f}, Lon: {longitude:.4f})
Time of visit: {time_of_day if time_of_day else 'Not specified'}
Shooting data within ~1km radius:
- Total incidents: {total_nearby}, Fatal: {murders_nearby}
- Borough breakdown: {json.dumps(boro_stats)}
- Time: Morning({time_counts['morning']}), Afternoon({time_counts['afternoon']}), Evening({time_counts['evening']}), Night({time_counts['night']})
- Recent community safety reports nearby: {community_nearby}
Recent incidents: {json.dumps([{"desc": s.get("location_desc",""), "time": s.get("occur_time",""), "date": s.get("occur_date","")[:10] if s.get("occur_date") else ""} for s in nearby[:8]])}
Provide JSON with keys: rating (1-10, 10=safest), risk_level (LOW/MODERATE/HIGH/CRITICAL), assessment (2-3 sentences), recommendations (array of 3-4 tips), best_times, avoid_times. RESPOND ONLY WITH VALID JSON."""

    try:
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
            session_id=f"safety-{uuid.uuid4()}",
            system_message="You are an expert NYC safety analyst. Respond in valid JSON only."
        ).with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            analysis = json.loads(json_match.group()) if json_match else {"rating": 5, "risk_level": "MODERATE", "assessment": response, "recommendations": [], "best_times": "Daytime", "avoid_times": "Late night"}
        except json.JSONDecodeError:
            analysis = {"rating": 5, "risk_level": "MODERATE", "assessment": response, "recommendations": [], "best_times": "Daytime", "avoid_times": "Late night"}
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        if total_nearby == 0: rating, risk = 9, "LOW"
        elif total_nearby < 5: rating, risk = 7, "LOW"
        elif total_nearby < 20: rating, risk = 5, "MODERATE"
        elif total_nearby < 50: rating, risk = 3, "HIGH"
        else: rating, risk = 1, "CRITICAL"
        analysis = {"rating": rating, "risk_level": risk, "assessment": f"Based on {total_nearby} shooting incidents nearby, this area has a {risk.lower()} risk level.", "recommendations": ["Stay aware of your surroundings", "Avoid poorly lit areas at night", "Travel with companions when possible"], "best_times": "Daytime hours (8am-5pm)", "avoid_times": "Late night (11pm-5am)"}

    analysis.update({"latitude": latitude, "longitude": longitude, "location_name": location_name, "incident_count": total_nearby, "community_reports_nearby": community_nearby, "analyzed_at": datetime.now(timezone.utc).isoformat()})
    return analysis

@api_router.post("/safety/analyze")
async def analyze_safety(req: SafetyAnalyzeRequest, user=Depends(get_current_user)):
    if not await check_analysis_limit(user):
        raise HTTPException(status_code=403, detail="Daily analysis limit reached. Upgrade to Premium for unlimited analyses.")
    await log_analysis(user["_id"])
    return await run_safety_analysis(req.latitude, req.longitude, req.location_name or "Unknown", req.time_of_day or "")

@api_router.get("/safety/limit")
async def get_analysis_limit(user=Depends(get_current_user)):
    tier = user.get("subscription_tier", "free")
    if tier == "premium":
        return {"tier": "premium", "used": 0, "limit": -1, "remaining": -1}
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    used = await db.analysis_log.count_documents({"user_id": user["_id"], "created_at": {"$gte": today_start}})
    return {"tier": "free", "used": used, "limit": FREE_ANALYSES_PER_DAY, "remaining": max(0, FREE_ANALYSES_PER_DAY - used)}

# ==================== AI CHAT ====================

@api_router.post("/chat")
async def chat_with_agent(req: ChatMessageRequest, user=Depends(get_current_user)):
    user_id = user["_id"]
    history = await db.chat_messages.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    history.reverse()
    context_messages = "".join(f"{'User' if m['role']=='user' else 'Agent'}: {m['content']}\n" for m in history)
    system_msg = """You are the Agentic Safeguard AI, an expert NYC safety advisor powered by real NYPD shooting incident data (2006-present). You help users understand safety risks, get ratings for locations, plan safer routes, and learn about risk patterns. Be helpful, factual, reassuring. Focus on actionable advice. Keep responses concise - 2-4 paragraphs max."""
    try:
        chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY", ""), session_id=f"chat-{user_id}-{uuid.uuid4()}", system_message=system_msg).with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=f"Previous conversation:\n{context_messages}\nUser's message: {req.message}\nRespond helpfully about NYC safety."))
        now = datetime.now(timezone.utc)
        await db.chat_messages.insert_many([
            {"user_id": user_id, "role": "user", "content": req.message, "created_at": now.isoformat()},
            {"user_id": user_id, "role": "assistant", "content": response, "created_at": (now + timedelta(milliseconds=1)).isoformat()}
        ])
        return {"response": response}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="AI agent temporarily unavailable.")

@api_router.get("/chat/history")
async def get_chat_history(user=Depends(get_current_user)):
    messages = await db.chat_messages.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", 1).limit(100).to_list(100)
    for msg in messages:
        if isinstance(msg.get("created_at"), datetime):
            msg["created_at"] = msg["created_at"].isoformat()
    return {"messages": messages}

@api_router.delete("/chat/history")
async def clear_chat_history(user=Depends(get_current_user)):
    result = await db.chat_messages.delete_many({"user_id": user["_id"]})
    return {"message": f"Cleared {result.deleted_count} messages"}

# ==================== PLANS / EVENTS ====================

@api_router.post("/plans")
async def create_plan(req: PlanEventRequest, user=Depends(get_current_user)):
    lat, lon = req.latitude, req.longitude
    if not lat or not lon:
        coords = await geocode_location(req.location_name)
        if coords:
            lat, lon = coords
    plan = {"id": str(uuid.uuid4()), "user_id": user["_id"], "title": req.title, "location_name": req.location_name,
            "latitude": lat, "longitude": lon, "start_time": req.start_time, "end_time": req.end_time,
            "notes": req.notes, "safety_analysis": None, "source": "manual", "created_at": datetime.now(timezone.utc).isoformat()}
    if lat and lon:
        try:
            plan["safety_analysis"] = await run_safety_analysis(lat, lon, req.location_name, req.start_time)
        except Exception:
            pass
    await db.plans.insert_one(plan)
    plan.pop("_id", None)
    return plan

@api_router.get("/plans")
async def get_plans(user=Depends(get_current_user)):
    plans = await db.plans.find({"user_id": user["_id"]}, {"_id": 0}).sort("start_time", 1).to_list(100)
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

# ==================== COMMUNITY REPORTS ====================

REPORT_CATEGORIES = ["shooting", "assault", "robbery", "suspicious_activity", "theft", "vandalism", "harassment", "other"]

@api_router.post("/reports")
async def create_report(req: ReportRequest, user=Depends(get_current_user)):
    if req.category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Use: {', '.join(REPORT_CATEGORIES)}")
    report = {
        "id": str(uuid.uuid4()), "user_id": user["_id"], "user_name": user.get("name", "Anonymous"),
        "title": req.title, "description": req.description, "category": req.category,
        "latitude": req.latitude, "longitude": req.longitude, "location_name": req.location_name or "",
        "photo": req.photo, "upvotes": 0, "downvotes": 0, "vote_users": {},
        "verified": False, "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.community_reports.insert_one(report)
    report.pop("_id", None)
    # Create notifications for users with plans near this location
    await _notify_nearby_users(req.latitude, req.longitude, req.title, req.category, user["_id"])
    return report

@api_router.get("/reports")
async def get_reports(category: Optional[str] = None, limit: int = 50, user=Depends(get_current_user)):
    query: dict = {}
    if category:
        query["category"] = category
    reports = await db.community_reports.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"reports": reports, "categories": REPORT_CATEGORIES}

@api_router.get("/reports/nearby")
async def get_nearby_reports(lat: float, lng: float, radius: float = 0.02, user=Depends(get_current_user)):
    reports = await db.community_reports.find({
        "latitude": {"$gte": lat - radius, "$lte": lat + radius},
        "longitude": {"$gte": lng - radius, "$lte": lng + radius},
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"reports": reports}

@api_router.get("/reports/map-data")
async def get_reports_map_data():
    reports = await db.community_reports.find(
        {"created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}},
        {"_id": 0, "id": 1, "latitude": 1, "longitude": 1, "category": 1, "title": 1, "upvotes": 1, "downvotes": 1, "created_at": 1}
    ).sort("created_at", -1).limit(200).to_list(200)
    return {"reports": reports}

@api_router.post("/reports/{report_id}/vote")
async def vote_report(report_id: str, req: VoteRequest, user=Depends(get_current_user)):
    if req.vote not in [1, -1]:
        raise HTTPException(status_code=400, detail="Vote must be 1 or -1")
    report = await db.community_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    user_id = user["_id"]
    vote_key = f"vote_users.{user_id}"
    existing_vote = report.get("vote_users", {}).get(user_id)
    if existing_vote == req.vote:
        raise HTTPException(status_code=400, detail="Already voted")
    update = {"$set": {vote_key: req.vote}}
    if existing_vote:
        if existing_vote == 1: update["$inc"] = {"upvotes": -1 + (1 if req.vote == 1 else 0), "downvotes": 1 if req.vote == -1 else 0}
        else: update["$inc"] = {"downvotes": -1 + (1 if req.vote == -1 else 0), "upvotes": 1 if req.vote == 1 else 0}
    else:
        update["$inc"] = {"upvotes": 1 if req.vote == 1 else 0, "downvotes": 1 if req.vote == -1 else 0}
    await db.community_reports.update_one({"id": report_id}, update)
    updated = await db.community_reports.find_one({"id": report_id}, {"_id": 0})
    return {"upvotes": updated.get("upvotes", 0), "downvotes": updated.get("downvotes", 0)}

@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, user=Depends(get_current_user)):
    result = await db.community_reports.delete_one({"id": report_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found or not yours")
    return {"message": "Report deleted"}

async def _notify_nearby_users(lat: float, lng: float, title: str, category: str, reporter_id: str):
    radius = 0.02
    nearby_plans = await db.plans.find({
        "latitude": {"$gte": lat - radius, "$lte": lat + radius},
        "longitude": {"$gte": lng - radius, "$lte": lng + radius},
        "user_id": {"$ne": reporter_id}
    }).to_list(100)
    notified_users = set()
    for plan in nearby_plans:
        uid = plan.get("user_id")
        if uid and uid not in notified_users:
            notified_users.add(uid)
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "user_id": uid, "type": "community_report",
                "title": f"New {category.replace('_', ' ')} report near your plan",
                "message": f"{title} - reported near {plan.get('location_name', 'your plan location')}",
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
            await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"unread_notifications": 1}})

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": user["_id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {"notifications": notifs}

@api_router.post("/notifications/mark-read")
async def mark_notifications_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["_id"], "read": False}, {"$set": {"read": True}})
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"unread_notifications": 0}})
    return {"message": "All notifications marked as read"}

@api_router.post("/notifications/register-token")
async def register_push_token(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    token = body.get("token")
    if token:
        await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"push_token": token}})
    return {"message": "Token registered"}

# ==================== GOOGLE CALENDAR ====================

@api_router.get("/calendar/status")
async def calendar_status(user=Depends(get_current_user)):
    configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    connected = bool(full_user and full_user.get("google_tokens"))
    return {"configured": configured, "connected": connected}

@api_router.get("/calendar/auth-url")
async def get_calendar_auth_url(request: Request, user=Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Calendar not configured. Admin needs to set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    host_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{host_url}/api/calendar/callback"
    flow = Flow.from_client_config({
        "web": {"client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}
    }, scopes=GOOGLE_SCOPES, redirect_uri=redirect_uri)
    auth_url, state = flow.authorization_url(access_type='offline', prompt='consent', state=user["_id"])
    return {"authorization_url": auth_url}

@api_router.get("/calendar/callback")
async def calendar_callback(code: str, state: str = ""):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Calendar not configured")
    try:
        token_resp = httpx.post('https://oauth2.googleapis.com/token', data={
            'code': code, 'client_id': GOOGLE_CLIENT_ID, 'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': f"{os.environ.get('FRONTEND_URL', '')}/api/calendar/callback",
            'grant_type': 'authorization_code'
        }).json()
        if 'access_token' in token_resp:
            user_id = state
            await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"google_tokens": token_resp, "google_calendar_connected": True}})
            return RedirectResponse(url="/?calendar_connected=true")
    except Exception as e:
        logger.error(f"Calendar callback error: {e}")
    return RedirectResponse(url="/?calendar_error=true")

@api_router.get("/calendar/events")
async def get_calendar_events(user=Depends(get_current_user)):
    if user.get("subscription_tier", "free") != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required for Google Calendar integration")
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user or not full_user.get("google_tokens"):
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    try:
        tokens = full_user["google_tokens"]
        creds = Credentials(token=tokens['access_token'], refresh_token=tokens.get('refresh_token'),
                          token_uri='https://oauth2.googleapis.com/token', client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET)
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"google_tokens.access_token": creds.token}})
        service = build('calendar', 'v3', credentials=creds)
        now = datetime.now(timezone.utc)
        events_result = service.events().list(calendarId='primary', timeMin=now.isoformat(), timeMax=(now + timedelta(days=7)).isoformat(), maxResults=20, singleEvents=True, orderBy='startTime').execute()
        events = events_result.get('items', [])
        return {"events": [{"id": e.get("id"), "summary": e.get("summary", ""), "location": e.get("location", ""), "start": e.get("start", {}).get("dateTime", e.get("start", {}).get("date", "")), "end": e.get("end", {}).get("dateTime", e.get("end", {}).get("date", ""))} for e in events]}
    except Exception as e:
        logger.error(f"Calendar events error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch calendar events")

@api_router.post("/calendar/analyze-day")
async def analyze_calendar_day(user=Depends(get_current_user)):
    if user.get("subscription_tier", "free") != "premium":
        raise HTTPException(status_code=403, detail="Premium subscription required")
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user or not full_user.get("google_tokens"):
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    try:
        tokens = full_user["google_tokens"]
        creds = Credentials(token=tokens['access_token'], refresh_token=tokens.get('refresh_token'),
                          token_uri='https://oauth2.googleapis.com/token', client_id=GOOGLE_CLIENT_ID, client_secret=GOOGLE_CLIENT_SECRET)
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        service = build('calendar', 'v3', credentials=creds)
        now = datetime.now(timezone.utc)
        today_end = now.replace(hour=23, minute=59, second=59)
        events_result = service.events().list(calendarId='primary', timeMin=now.isoformat(), timeMax=today_end.isoformat(), singleEvents=True, orderBy='startTime').execute()
        events = events_result.get('items', [])
        analyzed = []
        for event in events:
            location = event.get("location", "")
            if location:
                coords = await geocode_location(location)
                if coords:
                    analysis = await run_safety_analysis(coords[0], coords[1], location, event.get("start", {}).get("dateTime", ""))
                    analyzed.append({"event": event.get("summary", ""), "location": location, "safety": analysis})
        if analyzed:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["_id"], "type": "calendar_digest",
                "title": f"Daily Safety Digest: {len(analyzed)} events analyzed",
                "message": "; ".join(f"{a['event']}: {a['safety'].get('risk_level', 'N/A')}" for a in analyzed),
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
        return {"analyzed_events": analyzed}
    except Exception as e:
        logger.error(f"Calendar analyze error: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze calendar events")

@api_router.delete("/calendar/disconnect")
async def disconnect_calendar(user=Depends(get_current_user)):
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$unset": {"google_tokens": ""}, "$set": {"google_calendar_connected": False}})
    return {"message": "Google Calendar disconnected"}

# ==================== STRIPE PREMIUM ====================

@api_router.post("/subscription/checkout")
async def create_subscription_checkout(req: CheckoutRequest, http_request: Request, user=Depends(get_current_user)):
    if user.get("subscription_tier") == "premium":
        raise HTTPException(status_code=400, detail="Already subscribed to Premium")
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ.get("STRIPE_API_KEY", ""), webhook_url=webhook_url)
    success_url = f"{req.origin_url}/?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/?payment=cancelled"
    checkout_req = CheckoutSessionRequest(amount=PREMIUM_PRICE, currency="usd", success_url=success_url, cancel_url=cancel_url,
        metadata={"user_id": user["_id"], "user_email": user.get("email", ""), "plan": "premium"})
    session = await stripe_checkout.create_checkout_session(checkout_req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id, "user_id": user["_id"], "user_email": user.get("email", ""),
        "amount": PREMIUM_PRICE, "currency": "usd", "plan": "premium",
        "payment_status": "initiated", "status": "pending", "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/subscription/status/{session_id}")
async def check_subscription_status(session_id: str, http_request: Request, user=Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["_id"]})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "tier": "premium"}
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ.get("STRIPE_API_KEY", ""), webhook_url=webhook_url)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"payment_status": status.payment_status, "status": status.status}})
        if status.payment_status == "paid":
            await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"subscription_tier": "premium"}})
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["_id"], "type": "subscription",
                "title": "Welcome to Premium!", "message": "You now have unlimited analyses, Google Calendar integration, and priority support.",
                "read": False, "created_at": datetime.now(timezone.utc).isoformat()
            })
            return {"status": "complete", "payment_status": "paid", "tier": "premium"}
        return {"status": status.status, "payment_status": status.payment_status, "tier": "free"}
    except Exception as e:
        logger.error(f"Stripe status error: {e}")
        return {"status": tx.get("status", "pending"), "payment_status": tx.get("payment_status", "initiated"), "tier": user.get("subscription_tier", "free")}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=os.environ.get("STRIPE_API_KEY", ""), webhook_url=webhook_url)
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        if webhook_response.payment_status == "paid":
            user_id = webhook_response.metadata.get("user_id")
            if user_id:
                existing = await db.payment_transactions.find_one({"session_id": webhook_response.session_id, "payment_status": "paid"})
                if not existing:
                    await db.payment_transactions.update_one({"session_id": webhook_response.session_id}, {"$set": {"payment_status": "paid", "status": "complete"}})
                    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"subscription_tier": "premium"}})
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

# ==================== STATS ====================

@api_router.get("/stats/boroughs")
async def get_borough_stats():
    pipeline = [{"$group": {"_id": "$boro", "total": {"$sum": 1}, "murders": {"$sum": {"$cond": [{"$eq": ["$is_murder", True]}, 1, 0]}}}}, {"$sort": {"total": -1}}]
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
                if hour < 6: time_dist["00-06"] += 1
                elif hour < 12: time_dist["06-12"] += 1
                elif hour < 18: time_dist["12-18"] += 1
                else: time_dist["18-24"] += 1
            except (ValueError, IndexError):
                pass
    return {"distribution": time_dist}

@api_router.get("/stats/yearly")
async def get_yearly_stats():
    pipeline = [{"$match": {"year": {"$ne": None}}}, {"$group": {"_id": "$year", "total": {"$sum": 1}}}, {"$sort": {"_id": -1}}, {"$limit": 10}]
    stats = await db.shooting_data.aggregate(pipeline).to_list(10)
    return {"stats": [{"year": s["_id"], "total": s["total"]} for s in stats]}

@api_router.get("/geocode")
async def geocode(q: str):
    coords = await geocode_location(q)
    if coords:
        return {"latitude": coords[0], "longitude": coords[1], "query": q}
    raise HTTPException(status_code=404, detail="Location not found")

async def geocode_location(location_name: str):
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get("https://nominatim.openstreetmap.org/search",
                params={"q": f"{location_name}, New York City, NY", "format": "json", "limit": 1, "countrycodes": "us"},
                headers={"User-Agent": "AgenticSafeguard/1.0"}, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data:
                    return (float(data[0]["lat"]), float(data[0]["lon"]))
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
    return None

# ==================== STARTUP ====================

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.shooting_data.create_index([("latitude", 1), ("longitude", 1)])
    await db.shooting_data.create_index("boro")
    await db.shooting_data.create_index("year")
    await db.chat_messages.create_index([("user_id", 1), ("created_at", -1)])
    await db.plans.create_index([("user_id", 1), ("start_time", 1)])
    await db.community_reports.create_index([("latitude", 1), ("longitude", 1)])
    await db.community_reports.create_index("category")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.payment_transactions.create_index("session_id")
    await db.analysis_log.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("Database indexes created")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password), "name": "Admin", "role": "admin", "subscription_tier": "premium", "google_calendar_connected": False, "unread_notifications": 0, "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Admin user seeded: {admin_email}")
    else:
        # Update existing admin: password if changed, and ensure premium tier
        update_fields = {"subscription_tier": "premium", "role": "admin"}
        if not verify_password(admin_password, existing["password_hash"]):
            update_fields["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": update_fields})

    try:
        if await db.shooting_data.count_documents({}) == 0:
            logger.info("Syncing shooting data...")
            await sync_shooting_data()
    except Exception as e:
        logger.error(f"Failed to sync: {e}")

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
