# Agentic Safeguard - Product Requirements Document

## Overview
Agentic Safeguard is an AI-powered NYC safety intelligence mobile app that helps users assess and navigate safety risks across New York City using real NYPD shooting incident data (2006-Present).

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **AI**: Gemini 3 Flash via Emergent LLM Key
- **Map**: Leaflet.js with CartoDB Dark Matter tiles (iframe on web, WebView on native)
- **Data**: NYC OpenData SODA API (5,000 shooting records cached)
- **Auth**: JWT-based (bcrypt + access/refresh tokens)

## Features

### 1. Interactive Shooting Heatmap (Map Tab)
- Full-screen dark-themed map of NYC
- Color-coded heatmap overlay (green→yellow→red) showing shooting density
- Search bar for location lookup with Nominatim geocoding
- Tap-to-analyze: click any location for AI safety assessment
- Safety analysis modal with rating (1-10), risk level, recommendations, best/avoid times

### 2. AI Safety Agent Chat (Agent Tab)
- Conversational AI powered by Gemini 3 Flash
- Pre-built safety prompts for quick queries
- Context-aware responses based on NYPD shooting data
- Chat history with clear functionality
- Covers: neighborhood safety, route planning, risk patterns, safety tips

### 3. Safety-Aware Plans (Plans Tab)
- Add events with location, time, and notes
- Auto-geocoding of NYC locations via Nominatim
- Automatic AI safety analysis for each plan
- Color-coded risk badges (LOW/MODERATE/HIGH/CRITICAL)
- CRUD operations for plan management

### 4. Profile & Statistics (Profile Tab)
- User profile with role badge
- Borough shooting statistics with color indicators
- Time-of-day distribution chart (visual bars)
- Yearly trend data
- Sign out functionality

### 5. Authentication
- JWT-based auth with bcrypt password hashing
- Register/Login flows with form validation
- Auto-redirect based on auth state
- Bearer token stored in AsyncStorage

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/shootings | Get shooting data |
| GET | /api/shootings/heatmap | Get heatmap points |
| POST | /api/safety/analyze | AI safety analysis |
| POST | /api/chat | Chat with AI agent |
| GET | /api/chat/history | Get chat history |
| POST | /api/plans | Create plan |
| GET | /api/plans | Get user plans |
| GET | /api/stats/boroughs | Borough statistics |
| GET | /api/stats/time-distribution | Time distribution |
| GET | /api/geocode | Geocode location |

## Data Source
- NYC OpenData: NYPD Shooting Incident Data (2006-Present)
- API: https://data.cityofnewyork.us/resource/5ucz-vwe8.json
- ~5,000 records cached in MongoDB on startup

## Future Enhancements
- Google Calendar integration for autonomous daily safety analysis
- Push notifications for safety alerts
- Real-time incident updates
- Community reporting features
- Monetization via premium safety insights for businesses
