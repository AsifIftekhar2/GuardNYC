# Agentic Safeguard 🛡️

**AI-Powered NYC Safety Intelligence App**

A React Native mobile application that helps users assess and navigate safety risks across New York City using real NYPD shooting incident data (2006-Present) powered by AI.

![App Preview](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-blue)
![Tech Stack](https://img.shields.io/badge/Stack-React%20Native%20%7C%20FastAPI%20%7C%20MongoDB-green)

---

## 🌟 Features

- **🗺️ Interactive Shooting Heatmap** - Full-screen dark-themed map with color-coded density overlay
- **🤖 AI Safety Sentry** - Conversational AI powered by Gemini 3 Flash for safety queries
- **📅 Safety-Aware Event Planning** - Automatic AI safety analysis for scheduled events
- **📊 Statistics Dashboard** - Borough statistics, time distribution, and yearly trends
- **🔗 Google Calendar Integration** - Sync events with automatic safety assessments
- **🔐 JWT Authentication** - Secure user registration and login

---

## 🏗️ Tech Stack

### Frontend
- **React Native** with Expo SDK 54
- **Expo Router** (file-based routing)
- **TypeScript**
- **Leaflet.js** (maps via WebView)

### Backend
- **FastAPI** (Python)
- **MongoDB** (database)
- **Motor** (async MongoDB driver)
- **Google GenAI** (Gemini 1.5 Flash AI)

### Data Source
- **NYC OpenData** - NYPD Shooting Incident Data API
- ~5,000 shooting records cached locally

---

## 📋 Prerequisites

Before running this app locally, ensure you have:

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Python** 3.10+ ([Download](https://www.python.org/downloads/))
- **MongoDB** Community Edition ([Download](https://www.mongodb.com/try/download/community))
- **Yarn** package manager: `npm install -g yarn`
- **Git** ([Download](https://git-scm.com/download/win))

### Optional (for mobile development)
- **Android Studio** (for Android emulator)
- **Expo Go** app (for testing on physical device)

---

## 🚀 Local Setup - Windows

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

Create the following `.env` files:

**Backend** (`/backend/.env`):
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=agentic_safeguard
JWT_SECRET=your-secret-key-here-min-32-characters
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
GEMINI_API_KEY=your-google-gemini-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8001/api/google/callback
```

**Frontend** (`/frontend/.env`):
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

> ⚠️ **IMPORTANT**: Never commit `.env` files to Git. These files are already in `.gitignore`.

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
yarn web
```
✅ Opens at: `http://localhost:8081`

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

### Test Flow
1. Open the app and login with admin credentials
2. **Map Tab**: View NYC shooting heatmap, click locations for AI analysis
3. **Sentry Tab**: Chat with AI about safety concerns
4. **Plans Tab**: Create events with automatic safety analysis
5. **Profile Tab**: View statistics and user info

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
│   │   │   └── profile.tsx   # Profile screen
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
- Ensure `GEMINI_API_KEY` is set in `/backend/.env`
- Get a free API key from: https://aistudio.google.com/app/apikey
- Restart backend after adding the key: `supervisorctl restart backend`
- App uses **Google GenAI** (google-genai package) - latest stable API

---

## 🔐 Security Notes

### Environment Variables
- **Never commit `.env` files** to version control
- Use `.env.example` files (without sensitive values) for templates
- Rotate secrets regularly in production

### API Keys Required
1. **Google Gemini API Key** - For AI features (Gemini 1.5 Flash)
   - Get from: [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Set as `GEMINI_API_KEY` in backend `.env`
2. **Google OAuth Credentials** - For calendar integration
   - Get from: [Google Cloud Console](https://console.cloud.google.com)

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

- **NYC OpenData** - NYPD Shooting Incident Data
- **Emergent AI** - LLM integration platform
- **Expo Team** - React Native framework
- **FastAPI** - Modern Python web framework

---

## 📞 Support

For issues, questions, or feature requests:
- Create an issue in the repository
- Contact: [your-email@example.com]

---

## 🗺️ Roadmap

- [ ] Push notifications for safety alerts
- [ ] Real-time incident updates
- [ ] Community reporting features
- [ ] Route planning with safety optimization
- [ ] Premium safety insights for businesses
- [ ] Multi-city expansion

---

**Built with ❤️ for NYC Safety**
