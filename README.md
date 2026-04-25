# Sentry 🛡️

**AI-Powered NYC Safety Intelligence App**

A React Native (Expo Web) application that helps users assess and navigate safety risks across New York City using real NYPD crime data (2006-Present) powered by **local AI inference**.

![App Preview](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-blue)
![Tech Stack](https://img.shields.io/badge/Stack-React%20Native%20%7C%20FastAPI%20%7C%20MongoDB-green)
![AI](https://img.shields.io/badge/AI-Local%20Ollama-purple)

---

## 🌟 Features

- **🗺️ Interactive Crime Heatmap** - Full-screen dark-themed map with shooting incident overlay
- **🤖 AI Safety Sentry** - Conversational AI powered by local Ollama (nemotron-3-nano) for safety queries
- **📅 Safety-Aware Event Planning** - Automatic AI safety analysis for scheduled events with 400m radius
- **📊 Daily Safety Brief** - AI-generated morning summary of today's events with risk assessment
- **🔗 Google Calendar Integration** - Sync events with automatic safety assessments
- **🔐 JWT Authentication** - Secure user registration and login
- **🏠 100% Local AI** - Privacy-first design with zero cloud AI dependencies

---

## 🏗️ Tech Stack & Architecture

### Frontend
- **React Native** with Expo SDK 54
- **Expo Router** (file-based routing)
- **TypeScript**
- **Leaflet.js** (maps via WebView)
- **AsyncStorage** (token persistence)

### Backend
- **FastAPI** (Python 3.10+)
- **MongoDB** with Motor (async driver)
- **JWT Authentication** (python-jose + bcrypt)
- **Local Ollama AI** (nemotron-3-nano via Tailscale)
- **httpx** (async HTTP client for Ollama & NYC APIs)

### Data Sources
- **NYC OpenData SODA API**
  - NYPD Shooting Incident Data (Historic) - ~5,000+ records, 2006-present
  - NYPD Complaint Data (Historic + Current) - ~30,000+ records, last 3 years
- **Google Calendar API** (OAuth 2.0 integration)

### AI Infrastructure
- **Local Ollama Server** on Acer machine
- **Tailscale Private Network** (100.96.157.82:11434)
- **Model:** nemotron-3-nano (optimized for speed)
- **Privacy:** 100% local inference, no cloud AI calls

---

## 📐 Simple Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React Native App (Expo Web/iOS/Android)                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │  │   Map    │  │  Sentry  │  │  Plans   │  │ Profile  │   │ │
│  │  │   Tab    │  │  (Chat)  │  │   Tab    │  │   Tab    │   │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │ │
│  │                      ▲                                      │ │
│  │                      │ JWT Auth + API Calls                │ │
│  └──────────────────────┼──────────────────────────────────────┘ │
└────────────────────────┼─────────────────────────────────────────┘
                         │
                         │ HTTPS (localhost:8001 or deployed URL)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  server.py (Main API)                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │ │
│  │  │ Auth Routes  │  │ Data Sync    │  │ AI Routes    │     │ │
│  │  │ /api/auth/*  │  │ /api/*/sync  │  │ /api/chat    │     │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘     │ │
│  └────────────────────────────────────────────────────────────┘ │
│           │                    │                    │            │
│           ▼                    ▼                    ▼            │
│    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│    │   MongoDB    │   │  NYC OpenData│   │    Ollama    │      │
│    │   (Motor)    │   │   SODA API   │   │   (Tailscale)│      │
│    │              │   │              │   │              │      │
│    │  • users     │   │ • shootings  │   │ nemotron-3   │      │
│    │  • plans     │   │ • complaints │   │   -nano      │      │
│    │  • messages  │   │              │   │              │      │
│    │  • briefs    │   │              │   │ 100.96.157   │      │
│    └──────────────┘   └──────────────┘   │  .82:11434   │      │
│                                           └──────────────┘      │
│                        ┌──────────────┐                         │
│                        │Google Calendar│                        │
│                        │  OAuth 2.0   │                        │
│                        └──────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. User interacts with React Native UI
2. Frontend sends authenticated requests to FastAPI backend
3. Backend queries MongoDB for stored data
4. Backend syncs fresh crime data from NYC OpenData (on-demand)
5. Backend sends analysis prompts to local Ollama server via Tailscale
6. AI responses streamed back to frontend in real-time
7. Google Calendar events synced bidirectionally via OAuth
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ & **Yarn** package manager
- **Python** 3.10+
- **MongoDB** Community Edition (local) or Atlas (cloud)
- **Ollama** running on local network (optional for AI features)
- **Tailscale** (optional, for private Ollama access)

### 1. Clone & Install

```bash
# Clone repository
git clone <your-repo-url>
cd sentry-app

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install
```

### 2. Environment Configuration

**Backend** (create `/app/backend/.env`):
```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=agentic_safeguard

# Auth
JWT_SECRET=your-secret-key-minimum-32-characters-change-this
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123

# Local Ollama (via Tailscale)
OLLAMA_BASE_URL=http://100.96.157.82:11434
OLLAMA_MODEL=nemotron-3-nano

# Google OAuth (for Calendar - optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8001/api/google/callback
FRONTEND_URL=http://localhost:8081
```

**Frontend** (create `/app/frontend/.env`):
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

> 💡 **Tip:** Copy from `.env.example` files and update values

### 3. Run the App

**Terminal 1 - Start MongoDB:**
```bash
# macOS/Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

**Terminal 2 - Start Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
✅ API running at: http://localhost:8001  
📚 API docs: http://localhost:8001/docs

**Terminal 3 - Start Frontend:**
```bash
cd frontend

# For web preview (recommended)
npx expo start --web --port 3000

# For mobile (Expo Go app)
yarn start
```
✅ Web app: http://localhost:3000  
📱 Mobile: Scan QR code with Expo Go app

### 4. Login & Test
- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## 🔄 How to Reproduce Demo

### Step 1: Sync Crime Data
Once backend is running, sync NYC crime datasets:

```bash
# Sync shooting data (~5,000 records, ~30 seconds)
curl -X GET http://localhost:8001/api/shootings/sync

# Sync complaint data (~30,000 records, ~2-3 minutes)
curl -X GET http://localhost:8001/api/complaints/sync
```

### Step 2: Configure Ollama (for AI Features)
The app requires a **local Ollama server** for AI analysis:

**Option A: Local Ollama**
```bash
# Install Ollama: https://ollama.com/download
ollama serve

# Pull the model
ollama pull nemotron-3-nano

# Update backend/.env
OLLAMA_BASE_URL=http://localhost:11434
```

**Option B: Remote Ollama via Tailscale**
```bash
# Install Tailscale: https://tailscale.com/download
# Connect to your private network
# Get your Ollama machine's Tailscale IP
tailscale ip -4

# Update backend/.env with Tailscale IP
OLLAMA_BASE_URL=http://100.96.157.82:11434
```

### Step 3: Test Features
1. **Map Tab:** Tap any location to see AI safety analysis
2. **Sentry Tab:** Chat with AI about NYC safety
3. **Plans Tab:** Create an event, get automatic risk assessment
4. **Profile Tab:** Set daily brief time, view today's summary

**Without Ollama:** The app will fall back to rule-based risk scoring (no AI chat).

---

## 📊 Dataset Provenance & Synthetic Data

### Real Data Sources

All crime data is sourced from **NYC Open Data** (public domain):

1. **NYPD Shooting Incident Data (Historic)**
   - **Dataset ID:** `833y-fsy8`
   - **URL:** https://data.cityofnewyork.us/Public-Safety/NYPD-Shooting-Incident-Data-Historic-/833y-fsy8
   - **Years:** 2006 - Present
   - **Records:** ~5,000+ shooting incidents
   - **Fields:** Latitude, Longitude, Date/Time, Borough, Murder Flag
   - **Update Frequency:** Monthly by NYPD
   - **License:** Public Domain

2. **NYPD Complaint Data Historic**
   - **Dataset ID:** `qgea-i56i`
   - **URL:** https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Historic/qgea-i56i
   - **Years:** 2006 - 2023
   - **Records:** ~7 million total (app filters last 3 years, ~30,000 cached)
   - **Fields:** Latitude, Longitude, Offense Description, Severity (Felony/Misdemeanor/Violation)
   - **Update Frequency:** Quarterly
   - **License:** Public Domain

3. **NYPD Complaint Data Current (Year to Date)**
   - **Dataset ID:** `5uac-w243`
   - **URL:** https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date-/5uac-w243
   - **Years:** 2024-Present
   - **Update Frequency:** Weekly
   - **License:** Public Domain

### Data Processing
- **Geo-Indexing:** MongoDB 2dsphere indexes for fast radius queries
- **Filtering:** Complaint data limited to last 3 years for relevance
- **Normalization:** Crime density calculated per 100,000 sq meters
- **Validation:** Invalid coordinates (0,0 or null) excluded

### No Synthetic Data
This app uses **100% real crime data** from official NYPD sources. No synthetic or simulated data is used.

---

## ⚠️ Known Limitations & Next Steps

### Current Limitations

1. **🐌 AI Response Latency (Major)**
   - **Issue:** Risk analysis can take 5-30 seconds when using local Ollama on an Acer machine over Tailscale
   - **Cause:** 
     - Network latency over Tailscale VPN
     - Limited hardware resources on Acer machine
     - No prompt caching implemented
   - **Impact:** Suboptimal user experience, especially for real-time chat
   - **Mitigation:** Rule-based fallback activates if Ollama times out

2. **🔄 Manual Data Sync**
   - Crime data must be manually synced via API calls (`/api/shootings/sync`, `/api/complaints/sync`)
   - No automated scheduled updates (requires cron job or background worker)

3. **🗺️ NYC Only**
   - App only supports New York City crime data
   - No multi-city support

4. **📱 Mobile UI on Web**
   - Web preview is functional but optimized for mobile viewports
   - Desktop experience could be improved

### Performance Optimization Suggestions

#### Short-Term (Quick Wins)
- **Test Lighter Models:** Try `llama3-8b` or `mistral-7b` for faster inference
- **Enable Prompt Caching:** Ollama supports caching, could reduce repeat queries by 50%+
- **Add Progress Indicators:** Show "Analyzing safety..." with spinner during AI calls
- **Implement Request Timeouts:** Fail fast (3-5s) and use fallback instead of waiting 30s

#### Mid-Term (Architecture Changes)
- **Self-Hosted llama.cpp:** Faster inference than Ollama for single-model deployments
- **Quantized Models:** Use 4-bit quantization (GGUF format) for 2-3x speed boost
- **Response Streaming:** Already implemented, but could optimize chunk sizes
- **Edge Caching:** Cache common location analyses in MongoDB (TTL: 24 hours)

#### Long-Term (Production-Ready)
- **Cloud AI Fallback:** Use OpenAI/Anthropic as fallback when local Ollama is slow
- **Dedicated Inference Server:** Deploy vLLM or TensorRT-LLM on GPU instance
- **CDN for Data:** Serve pre-computed heatmap tiles for instant map loads
- **Background Workers:** Celery + Redis for async analysis jobs

### Next Steps (Prioritized)
1. ✅ Document architecture and setup (this README)
2. 🔄 Implement scheduled data sync (cron job or GitHub Actions)
3. 🚀 Test alternative Ollama models for speed
4. 📊 Add analytics to measure actual AI latency in production
5. 🌐 Deploy to cloud (Railway/Render for backend, Vercel for web frontend)

---

## 🚀 Local Setup (Detailed - Windows/macOS/Linux)

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd agentic-safeguard
```

### Step 2: Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Command Prompt:
venv\Scripts\activate.bat

# PowerShell:
venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Frontend Setup

```bash
# Navigate to frontend folder (from root)
cd frontend

# Install dependencies
yarn install
```

### Step 4: Environment Configuration

See **"🚀 Quick Start"** section above for complete `.env` configuration guide with all required variables.

---

## ▶️ Running the Application

You need **3 terminal windows** to run the complete app:

### Terminal 1: Start MongoDB

```bash
# Start MongoDB service (Windows)
net start MongoDB

# Or run manually
mongod
```

### Terminal 2: Start Backend API

```bash
cd backend
venv\Scripts\activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

✅ Backend API: `http://localhost:8001`
📚 API Docs: `http://localhost:8001/docs`

### Terminal 3: Start Frontend

**Option A: Web Browser** (Recommended for development)
```bash
cd frontend
npx expo start --web --port 3000
```
✅ Opens at: `http://localhost:3000`

**Option B: Mobile Device with Expo Go**
```bash
cd frontend
yarn start
```
- Install **Expo Go** from App Store / Play Store
- Scan QR code from terminal
- Ensure phone and computer are on same WiFi

**Option C: Android Emulator**
```bash
cd frontend
yarn android
```
- Requires Android Studio with configured emulator

**Option D: iOS Simulator** (Mac only)
```bash
cd frontend
yarn ios
```

---

## 🧪 Testing the App

### Default Credentials
- **Email**: `admin@example.com`
- **Password**: `admin123`

*(Auto-seeded on first backend startup)*

### Test Flow
1. Open the app and login with admin credentials
2. **Map Tab**: View NYC shooting heatmap, tap locations for AI analysis (requires Ollama)
3. **Sentry Tab**: Chat with AI about safety concerns (requires Ollama, shows "AI unavailable" fallback otherwise)
4. **Plans Tab**: Create events with automatic safety analysis
5. **Profile Tab**: Configure daily brief time, view today's summary

---

## 📁 Project Structure

```
/
├── backend/
│   ├── server.py              # FastAPI main server
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Backend environment variables (not committed)
│   └── tests/                 # Backend tests
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/           # Auth screens (login, register)
│   │   ├── (tabs)/           # Main app tabs
│   │   │   ├── index.tsx     # Map screen
│   │   │   ├── chat.tsx      # Sentry (AI chat) screen
│   │   │   ├── calendar.tsx  # Plans screen
│   │   │   └── profile.tsx   # Profile & daily brief screen
│   │   ├── oauth-callback.tsx # Google OAuth popup handler
│   │   ├── _layout.tsx       # Root layout
│   │   └── index.tsx         # Entry point
│   ├── context/
│   │   └── AuthContext.tsx   # Auth state management
│   ├── utils/
│   │   └── api.ts            # API client
│   ├── package.json          # Dependencies
│   └── .env                  # Frontend environment variables (not committed)
│
├── memory/
│   ├── PRD.md                # Product Requirements Document
│   └── test_credentials.md   # Test account credentials
│
├── OLLAMA_SETUP.md           # Ollama configuration guide
├── SAFETY_ENHANCEMENT.md     # Risk assessment methodology
└── README.md                 # This file
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Shooting Data
- `GET /api/shootings` - Get shooting data
- `GET /api/shootings/heatmap` - Get heatmap points
- `POST /api/shootings/sync` - Sync data from NYC OpenData

### AI Safety Analysis
- `POST /api/safety/analyze` - Analyze location safety
- `POST /api/chat` - Chat with AI Sentry
- `GET /api/chat/history` - Get chat history
- `DELETE /api/chat/history` - Clear chat history

### Event Planning
- `POST /api/plans` - Create event plan
- `GET /api/plans` - Get user's plans
- `DELETE /api/plans/{plan_id}` - Delete plan
- `POST /api/plans/{plan_id}/analyze` - Analyze plan safety

### Statistics
- `GET /api/stats/boroughs` - Borough statistics
- `GET /api/stats/time-distribution` - Time distribution
- `GET /api/stats/yearly` - Yearly trends

### Google Calendar Integration
- `GET /api/google/auth` - Initiate OAuth flow
- `GET /api/google/callback` - OAuth callback
- `GET /api/google/status` - Check connection status
- `POST /api/google/sync` - Manually sync events
- `POST /api/google/disconnect` - Disconnect calendar

---

## 🔧 Troubleshooting

### MongoDB Not Starting
```bash
# Check if MongoDB service is running
net start | findstr MongoDB

# Start MongoDB
net start MongoDB
```

### Port Already in Use
```bash
# Find process using port 8001
netstat -ano | findstr :8001

# Kill the process
taskkill /PID <process-id> /F
```

### Python Virtual Environment Issues
```powershell
# PowerShell execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Expo Metro Bundler Cache Issues
```bash
cd frontend
yarn start --clear
```

### Database Connection Errors
- Ensure MongoDB is running: `net start MongoDB`
- Check MONGO_URL in `/backend/.env`
- Verify MongoDB is listening on port 27017

### API Not Responding
- Check if backend is running on port 8001
- Verify EXPO_PUBLIC_BACKEND_URL in `/frontend/.env`
- Check backend logs for errors

### AI Features Not Working
- Ensure Ollama is running and accessible
- **Local Ollama:** Check `OLLAMA_BASE_URL=http://localhost:11434` in `/backend/.env`
- **Remote Ollama:** Verify Tailscale connection and IP address
- Test Ollama manually: `curl http://localhost:11434/api/tags`
- App will use rule-based fallback if Ollama is unavailable (no AI chat, basic risk scores)
- See `/app/OLLAMA_SETUP.md` for detailed configuration

---

## 🔐 Security Notes

### Environment Variables
- **Never commit `.env` files** to version control
- Use `.env.example` files (without sensitive values) for templates
- Rotate secrets regularly in production

### API Keys Required
1. **Local Ollama Server** - For AI features (free, self-hosted)
   - Install from: [ollama.com](https://ollama.com/download)
   - Model: `nemotron-3-nano` (or any compatible model)
   - Set as `OLLAMA_BASE_URL` in backend `.env`
   - **Optional:** Can use cloud AI as alternative (requires API keys)
2. **Google OAuth Credentials** - For calendar integration (optional)
   - Get from: [Google Cloud Console](https://console.cloud.google.com)
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend `.env`

---

## 📱 Running on Mobile Device

### Using Expo Go App
1. Install **Expo Go** from your app store
2. Ensure phone and computer are on the **same WiFi network**
3. Run `yarn start` in the frontend directory
4. Scan the QR code:
   - **Android**: Use Expo Go app to scan
   - **iOS**: Use Camera app to scan

### Common Mobile Issues
- **Connection refused**: Check firewall settings, ensure same WiFi
- **Slow loading**: Clear Expo cache with `yarn start --clear`
- **White screen**: Check backend URL in frontend `.env` file

---

## 🌐 Production Deployment

### Backend (FastAPI)
- Deploy to platforms like Railway, Render, or AWS
- Set environment variables via platform dashboard
- Enable HTTPS
- Update CORS origins in `server.py`

### Frontend (Expo)
- **Web**: `yarn build` and deploy to Vercel/Netlify
- **iOS**: Use EAS Build (`eas build --platform ios`)
- **Android**: Use EAS Build (`eas build --platform android`)

### Database (MongoDB)
- Use MongoDB Atlas for cloud hosting
- Update MONGO_URL in production environment

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **NYC OpenData** - NYPD Shooting Incident Data & Complaint Data (public domain)
- **Ollama** - Local AI inference platform
- **Expo Team** - React Native framework
- **FastAPI** - Modern Python web framework
- **Tailscale** - Secure private networking

---

## 📞 Support

For issues, questions, or feature requests:
- Create an issue in the repository
- Contact: [your-email@example.com]

---

## 🗺️ Roadmap

### Current Focus
- ✅ Complete local Ollama AI migration (DONE)
- ✅ Inverted risk scale (1=safest, 10=dangerous) (DONE)
- ✅ NYPD Complaint Data integration (DONE)
- ✅ Daily Safety Brief feature (DONE)
- 🔄 Performance optimization for AI latency (IN PROGRESS)

### Near-Term
- [ ] Automated scheduled data sync (cron jobs)
- [ ] Test alternative models for faster inference
- [ ] Implement prompt caching for repeated queries
- [ ] Add loading states and progress indicators
- [ ] Deploy to production (Railway + Vercel)

### Mid-Term
- [ ] Push notifications for high-risk event alerts
- [ ] Real-time data updates from NYC OpenData
- [ ] Safe route planning between two points
- [ ] Community reporting features
- [ ] Mobile app builds (iOS/Android via EAS)

### Long-Term
- [ ] Multi-city expansion (Chicago, LA, etc.)
- [ ] Predictive risk modeling (time series forecasting)
- [ ] Premium insights for businesses
- [ ] API access for developers
- [ ] Multi-language support (Spanish priority)

---

**Built with ❤️ for NYC Safety**
