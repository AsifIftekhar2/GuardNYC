# Agentic Safeguard - Product Requirements Document

**Version:** 1.0  
**Last Updated:** April 12, 2026  
**Status:** MVP Complete

---

## 1. Product Overview

### Vision
Agentic Safeguard is an AI-powered NYC safety intelligence mobile application that helps users make informed decisions about when and where to go in New York City by providing real-time, data-driven safety assessments based on historical crime data and AI analysis.

### Mission
Empower NYC residents and visitors with personalized, accurate, and actionable safety insights to navigate the city confidently while minimizing risk.

### Target Users
- NYC residents planning daily activities
- Visitors and tourists exploring the city
- Event planners selecting venues
- Safety-conscious individuals planning routes
- Parents coordinating children's activities

---

## 2. Core Features

### 2.1 Interactive Safety Map
**Status:** ✅ Implemented

- **Full-screen shooting heatmap** with dark theme
- **Color-coded density overlay** showing incident concentration
- **Tap-to-analyze** any location for instant safety assessment
- **400m radius analysis** for focused neighborhood-level insights
- **Real-time AI analysis** using local Ollama inference
- **Comprehensive data**: NYPD shooting data (2006-present) + complaint data (last 3 years)

**Technical Implementation:**
- Leaflet.js map in WebView (cross-platform compatibility)
- Clustering for performance with large datasets
- Geolocation-based queries with MongoDB geo-indexing
- Inverted risk scale: 1 = safest, 10 = most dangerous

### 2.2 AI Safety Sentry (Chat)
**Status:** ✅ Implemented

- **Conversational AI advisor** powered by local Ollama (nemotron-3-nano)
- **Streaming responses** for real-time interaction
- **Context-aware answers** about NYC safety patterns
- **Historical data integration** from shooting and complaint datasets
- **Chat history** with persistent storage
- **Clear chat** functionality

**Key Capabilities:**
- Answer safety questions about specific locations
- Provide time-of-day recommendations
- Explain risk patterns and trends
- Offer alternative safer locations
- Natural language interaction with plain text formatting

### 2.3 Safety-Aware Event Planning
**Status:** ✅ Implemented

- **Manual event creation** with title, location, and time
- **Automatic safety analysis** for each event location
- **Risk rating display** (1-10 scale with color coding)
- **Safety recommendations** specific to event location and time
- **Google Calendar integration** with OAuth 2.0
  - Bi-directional sync
  - Auto safety analysis for imported events
  - Event-specific risk badges
- **Event deletion** with confirmation

**Risk Assessment:**
- 400m radius analysis around event location
- Shooting density calculation
- Complaint data analysis (felonies, misdemeanors, violations)
- Time-of-day risk factors
- Balanced assessment to avoid false alarms

### 2.4 Daily Safety Brief
**Status:** ✅ Implemented

- **AI-generated daily summary** of user's plan safety
- **Time-based lazy evaluation** (generates once daily at user's preferred time)
- **User-configurable generation time** (default: 6 AM)
- **Comprehensive analysis** of all today's events
- **Alternative recommendations** for high-risk events
- **Average risk calculation** across all daily plans
- **High-risk event detection** and warnings
- **Manual regeneration** option available anytime

**Technical Implementation:**
- Cached briefs in user document
- Automatic regeneration when user opens app after preferred time
- No background schedulers (pure lazy evaluation)
- Plain text formatting for readability

### 2.5 User Profile & Statistics
**Status:** ✅ Implemented

- **User information display** (name, email, role)
- **Daily brief section** replacing generic statistics
- **Brief generation settings** with time picker modal
- **Logout functionality** with confirmation
- **Pull-to-refresh** for manual brief updates
- **Next generation time** display

### 2.6 Authentication & Security
**Status:** ✅ Implemented

- **JWT-based authentication** with access and refresh tokens
- **bcrypt password hashing** (14 rounds)
- **Secure token management** with AsyncStorage
- **Auto-seeded admin account** on first run
- **User registration** with email validation
- **Protected routes** requiring authentication
- **Token expiration handling**

---

## 3. Technical Architecture

### 3.1 Frontend Stack
- **Framework:** React Native with Expo SDK 54
- **Routing:** Expo Router (file-based)
- **Language:** TypeScript
- **State Management:** React Context API (AuthContext)
- **Maps:** Leaflet.js in WebView
- **Styling:** React Native StyleSheet with dark theme
- **API Client:** Custom fetch-based utility with token injection

### 3.2 Backend Stack
- **Framework:** FastAPI (Python 3.10+)
- **Database:** MongoDB with Motor (async driver)
- **Authentication:** JWT (python-jose) + bcrypt
- **AI Integration:** Local Ollama server via HTTP
- **External APIs:** 
  - NYC OpenData SODA API (shooting + complaint data)
  - Google Calendar API (OAuth 2.0)
- **CORS:** Configured for cross-origin requests

### 3.3 AI & ML
- **Model:** nemotron-3-nano (optimized for speed)
- **Inference:** Local Ollama server on Acer machine
- **Connection:** Tailscale private mesh network (100.96.157.82:11434)
- **Streaming:** Server-Sent Events (SSE) for real-time responses
- **Fallback:** Rule-based risk assessment when Ollama unavailable
- **Privacy:** 100% local processing, no cloud AI dependencies

### 3.4 Data Sources
**Primary Datasets:**

1. **NYPD Shooting Incident Data (Historic)**
   - Dataset ID: 833y-fsy8
   - Years: 2006-Present
   - Records: ~5,000+
   - Fields: Location, date/time, borough, fatality status
   - Update Frequency: Monthly from NYC OpenData

2. **NYPD Complaint Data (Historic + Current)**
   - Dataset IDs: qgea-i56i (historic), 5uac-w243 (current)
   - Years: Last 3 years
   - Records: ~30,000+
   - Fields: Location, offense type, severity (Felony/Misdemeanor/Violation)
   - Categories: All reported crimes
   - Update Frequency: Weekly from NYC OpenData

**Data Processing:**
- Geo-indexing for fast radius queries
- Density normalization per 100k sq meters
- Time-based filtering and aggregation
- Borough-level statistics

### 3.5 Database Schema

**Collections:**

```javascript
// users
{
  _id: ObjectId,
  id: String (UUID),
  name: String,
  email: String (unique),
  password_hash: String,
  role: String ("admin" | "user"),
  brief_preferred_hour: Number (0-23),
  last_brief_generated: String (ISO timestamp),
  cached_daily_brief: Object,
  created_at: String
}

// shooting_data
{
  incident_key: String,
  occur_date: String,
  occur_time: String,
  boro: String,
  latitude: Number,
  longitude: Number,
  is_murder: Boolean,
  location_desc: String,
  year: Number
}

// complaint_data
{
  complaint_num: String,
  complaint_date: String,
  complaint_time: String,
  latitude: Number,
  longitude: Number,
  boro: String,
  offense: String,
  severity: String ("FELONY" | "MISDEMEANOR" | "VIOLATION"),
  year: Number
}

// plans
{
  _id: ObjectId,
  id: String (UUID),
  user_id: ObjectId,
  title: String,
  location_name: String,
  start_time: String (ISO),
  safety_analysis: {
    rating: Number (1-10),
    risk_level: String,
    assessment: String,
    recommendations: Array<String>,
    best_times: String,
    avoid_times: String
  },
  google_event_id: String (optional),
  created_at: String
}

// chat_messages
{
  _id: ObjectId,
  user_id: ObjectId,
  role: String ("user" | "assistant"),
  content: String,
  created_at: String
}

// google_tokens
{
  _id: ObjectId,
  user_id: ObjectId,
  token: String (encrypted JSON),
  created_at: String
}
```

---

## 4. Risk Assessment Methodology

### 4.1 Analysis Radius
- **Current:** 400 meters (~0.0036 degrees)
- **Previous:** 1000 meters (too broad, changed for accuracy)
- **Rationale:** Focuses on immediate neighborhood, not entire district

### 4.2 Risk Scoring Algorithm

**Inputs:**
1. Shooting incidents within 400m (historical, 2006-present)
2. Complaint data within 400m (last 3 years)
3. Crime severity weighting (Felonies > Misdemeanors > Violations)
4. Time-of-day distribution
5. Crime density per 100k sq meters

**Rating Scale (Balanced):**
```
1-2:  Very Safe       (0-2 shootings, minimal complaints)
3-4:  Safe            (2-5 shootings, moderate complaints)
5-6:  Moderate Risk   (5-10 shootings, higher complaints)
7-8:  Elevated Risk   (10-20 shootings, many complaints)
9-10: High Risk       (20+ shootings, very high crime)
```

**Risk Level Mapping:**
- 1-4: LOW RISK (green)
- 5-6: MODERATE RISK (yellow)
- 7-10: HIGH RISK (red)

### 4.3 AI Analysis Process

**When Ollama Available:**
1. Query MongoDB for shooting + complaint data in 400m radius
2. Calculate statistics (totals, densities, distributions)
3. Build comprehensive prompt with all data
4. Send to Ollama (nemotron-3-nano) with streaming
5. Parse AI response (JSON for safety analysis, plain text for chat)
6. Return structured assessment

**Fallback (Ollama Unavailable):**
1. Use rule-based scoring on shooting data
2. Apply balanced thresholds (see scale above)
3. Generate standardized recommendations
4. Return assessment with fallback indicator

### 4.4 Balanced Assessment Features
- Emphasizes violent crime (shootings) over minor complaints
- Considers historical context (15 shootings over 15 years ≠ high risk)
- Weighs felonies heavily, violations lightly
- Avoids exaggeration and panic-inducing language
- Provides actionable recommendations over generic warnings

---

## 5. User Workflows

### 5.1 First-Time User
1. Open app → Login/Register screen
2. Create account or use demo (admin@example.com / admin123)
3. Navigate to Map tab (default)
4. View shooting heatmap overlay
5. Tap any location → See safety analysis popup
6. Explore other tabs (Sentry, Plans, Profile)

### 5.2 Daily Planning
1. Morning: Open app (after preferred brief time, e.g., 6 AM)
2. Profile tab → View today's daily brief
3. See risk summary for all today's events
4. Review alternatives for high-risk events
5. Plans tab → Adjust or add events as needed
6. Map tab → Check routes between events

### 5.3 Location Safety Check
1. Map tab → Tap location of interest
2. View popup with:
   - Risk rating (1-10)
   - Risk level badge (LOW/MODERATE/HIGH)
   - Brief assessment
   - Recommendations list
   - Best/avoid times
3. Make informed decision

### 5.4 Event Creation
1. Plans tab → Tap "+" button
2. Enter event details (title, location, date/time)
3. Save → Automatic safety analysis runs
4. View event card with risk badge
5. Tap event → See full safety details
6. Optional: Connect Google Calendar for auto-sync

### 5.5 AI Consultation
1. Sentry tab → Type question
2. Examples:
   - "Is Brooklyn safe at night?"
   - "Where should I avoid in Manhattan?"
   - "Best time to visit Times Square?"
3. View streaming AI response in real-time
4. Continue conversation with follow-up questions
5. Clear chat anytime with trash icon (only visible when chat active)

---

## 6. Security & Privacy

### 6.1 Data Privacy
- **Local AI Processing:** All AI inference on user's Acer machine via Tailscale
- **No Cloud AI:** No data sent to Google, OpenAI, or other cloud providers
- **Encrypted Tokens:** JWT tokens securely stored
- **HTTPS Only:** All API communication encrypted
- **Private Network:** Ollama accessible only via Tailscale mesh

### 6.2 Authentication Security
- **Password Hashing:** bcrypt with 14 rounds
- **Token Expiration:** Access tokens expire (configurable)
- **Refresh Tokens:** Secure token renewal
- **No Password Storage:** Only hashes stored
- **Protected Endpoints:** All user data behind authentication

### 6.3 API Security
- **CORS:** Configured for trusted origins only
- **Input Validation:** Pydantic models for all requests
- **SQL Injection:** N/A (MongoDB, no raw queries)
- **Rate Limiting:** Not implemented (single-user demo)

---

## 7. Known Limitations

### 7.1 Performance
- **AI Latency:** Risk analysis can be slow (5-30s) with local Ollama inference on Acer machine
  - Optimization options: Test different models (llama3, mistral), inference providers (llama.cpp, vLLM), or quantization levels
  - Alternative: Cloud API fallback for production use
- **Data Sync:** Complaint data sync takes 2-3 minutes (~30k records)
- **Map Rendering:** May lag with all 5,000+ shooting markers on low-end devices

### 7.2 Data Limitations
- **Historical Data:** Shooting data includes incidents from 2006, may not reflect current conditions
- **Update Frequency:** Data synced manually, not real-time
- **Coverage:** NYC only, no other cities supported
- **Complaint Data:** Optional, app works with shooting data only if not synced

### 7.3 Technical Constraints
- **Ollama Dependency:** Full AI features require Ollama running on Acer with Tailscale
  - Preview environment uses rule-based fallback
  - Local development requires network setup
- **Mobile-Only:** Optimized for mobile, web preview has limited UX
- **Tailscale Requirement:** For local AI, both Acer and dev machine must be on Tailscale network

### 7.4 Functional Gaps
- **No Route Planning:** No multi-point route safety optimization
- **No Push Notifications:** No proactive alerts for entering dangerous areas
- **No Community Reports:** User-generated safety data not supported
- **Single Language:** English only

---

## 8. Future Enhancements

### 8.1 Near-Term (Next Sprint)
- [ ] **Performance Optimization**
  - Test lightweight models (llama3-8b, mistral-7b)
  - Implement prompt caching for faster responses
  - Add loading states and progress indicators
- [ ] **Data Enhancements**
  - Scheduled complaint data auto-sync (daily/weekly)
  - Real-time data updates from NYC OpenData
  - Historical trends and comparisons
- [ ] **UX Improvements**
  - Onboarding tutorial for first-time users
  - Help/FAQ section
  - In-app feedback mechanism

### 8.2 Mid-Term (Next Month)
- [ ] **Advanced Features**
  - Multi-point route planning with safety optimization
  - Safe route suggestions between two points
  - Avoid dangerous areas routing
  - Time-based route suggestions
- [ ] **Notifications**
  - Push notifications for high-risk events
  - Daily brief push at preferred time
  - Location-based safety alerts
- [ ] **Social Features**
  - Share safe routes with friends
  - Community safety reports
  - Verified user tips

### 8.3 Long-Term (Roadmap)
- [ ] **Expansion**
  - Support other major US cities (Chicago, LA, etc.)
  - International cities (London, Toronto)
  - Multi-language support (Spanish priority)
- [ ] **Premium Features**
  - Business safety insights
  - Custom risk thresholds
  - Export safety reports
  - API access for developers
- [ ] **Advanced AI**
  - Predictive risk modeling (time series forecasting)
  - Pattern recognition for emerging hotspots
  - Personalized risk profiles based on user preferences

---

## 9. Success Metrics

### 9.1 User Engagement
- Daily Active Users (DAU)
- Average session duration
- Events created per user
- Map taps per session
- Chat messages per user

### 9.2 Feature Adoption
- % users connecting Google Calendar
- % users customizing daily brief time
- % users checking map before events
- AI chat usage rate

### 9.3 Safety Impact
- High-risk events rescheduled (user-reported)
- Alternative locations chosen
- User testimonials on feeling safer

---

## 10. Technical Debt & Maintenance

### 10.1 Code Quality
- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] Set up CI/CD pipeline
- [ ] Implement error tracking (Sentry)
- [ ] Add performance monitoring

### 10.2 Documentation
- [x] PRD.md (this document)
- [x] README.md with quick start
- [x] API documentation (FastAPI auto-docs at /docs)
- [ ] User guide / Help center
- [ ] Developer onboarding guide

### 10.3 Infrastructure
- [ ] Database backups and recovery
- [ ] Monitoring and alerting
- [ ] Load testing
- [ ] Scalability planning for multi-user

---

## 11. Compliance & Legal

### 11.1 Data Usage
- **Public Data Only:** All crime data from NYC OpenData (public domain)
- **No PII Collection:** Minimal user data (email, name only)
- **GDPR Considerations:** Data deletion on request (if applicable)

### 11.2 Disclaimers
- App provides informational guidance only
- Not a substitute for professional security advice
- Past crime data doesn't guarantee future safety
- Users responsible for their own safety decisions

---

## 12. Deployment

### 12.1 Current Environment
- **Preview:** Emergent hosted (https://load-app-10.preview.emergentagent.com)
- **Database:** MongoDB on localhost (preview environment)
- **AI:** Ollama on Acer machine (100.96.157.82:11434 via Tailscale)

### 12.2 Local Development
- **Backend:** FastAPI on localhost:8001
- **Frontend:** Expo on localhost:8081
- **Database:** MongoDB on localhost:27017
- **AI:** Ollama on Tailscale IP or localhost

### 12.3 Production Considerations
- Cloud-hosted MongoDB (Atlas recommended)
- Vercel/Railway for backend API
- Expo EAS for mobile builds
- Cloud AI provider or self-hosted Ollama cluster

---

## Document History
- **v1.0** - April 12, 2026 - Initial PRD post-MVP
- **v0.9** - April 11, 2026 - Pre-launch draft
- **v0.5** - April 10, 2026 - Early development spec
