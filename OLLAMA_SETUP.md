# Local Ollama Integration Guide

## Setup Complete! ✅

Your Agentic Safeguard app is now configured to use your local Ollama server on the Acer machine.

## Configuration

### Backend Environment Variables (`/backend/.env`)
```env
OLLAMA_BASE_URL=http://100.96.157.82:11434
OLLAMA_MODEL=nemotron-3-nano
```

### Network Details
- **Acer Machine (Ollama Server)**: 100.96.157.82:11434
- **Lenovo Laptop (Development)**: 100.107.63.126
- **Connection**: Tailscale private mesh network

## Features Implemented

### 1. **Streaming Chat Responses** ✅
   - Real-time token-by-token streaming
   - Server-Sent Events (SSE) protocol
   - Frontend updates as AI generates response

### 2. **Safety Analysis** ✅
   - Uses Ollama for location safety assessment
   - Analyzes NYPD shooting data with AI
   - JSON-formatted safety ratings

### 3. **All AI Removed from Cloud** ✅
   - No Google Gemini API calls
   - No external AI dependencies
   - 100% local inference on your Acer

## How It Works

### Chat Flow:
```
User Message → Backend /api/chat
             ↓
Frontend ← SSE Stream ← Ollama (Acer) ← HTTP Request
```

### Ollama API Call:
```json
POST http://100.96.157.82:11434/api/chat
{
  "model": "nemotron-3-nano",
  "messages": [
    {"role": "system", "content": "You are an NYC safety advisor..."},
    {"role": "user", "content": "Is Brooklyn safe?"}
  ],
  "stream": true
}
```

### Streaming Response:
```json
{"message": {"role": "assistant", "content": "Brooklyn"}}
{"message": {"role": "assistant", "content": " is"}}
{"message": {"role": "assistant", "content": " generally"}}
{"message": {"role": "assistant", "content": " safe..."}}
{"done": true}
```

## Testing Locally

### Prerequisites:
1. **Tailscale running on both devices**
   ```bash
   # Check Tailscale status
   tailscale status
   ```

2. **Ollama running on Acer**
   ```bash
   # Check Ollama is accessible
   curl http://100.96.157.82:11434/api/tags
   ```

3. **nemotron-3-nano model installed**
   ```bash
   # On Acer machine
   ollama pull nemotron-3-nano
   ollama list  # Verify it's there
   ```

### Test the Integration:

**1. Test Ollama directly:**
```bash
curl http://100.96.157.82:11434/api/chat -d '{
  "model": "nemotron-3-nano",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": false
}'
```

**2. Test through backend:**
```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.access_token')

# Test chat endpoint
curl -X POST http://localhost:8001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message"}'
```

**3. Test in browser:**
- Open app: http://localhost:8081
- Login with admin@example.com / admin123
- Go to "Sentry" tab
- Send a message - you should see streaming responses!

## Troubleshooting

### ❌ "Cannot reach Ollama server"
**Causes:**
- Tailscale not running on one or both devices
- Ollama not running on Acer
- Firewall blocking port 11434
- Wrong Tailscale IP

**Solutions:**
```bash
# On Acer: Check Tailscale IP
tailscale ip -4

# On Acer: Start Ollama
ollama serve

# On Lenovo: Test connection
ping 100.96.157.82
curl http://100.96.157.82:11434/api/tags
```

### ❌ "Model not found: nemotron-3-nano"
```bash
# On Acer machine
ollama pull nemotron-3-nano
ollama list  # Verify
```

### ❌ Streaming not working in browser
- Check browser console (F12) for errors
- Ensure backend is running: `supervisorctl status backend`
- Check backend logs: `tail -f /var/log/supervisor/backend.err.log`

### ❌ Connection works via SSH tunnel but not Tailscale
```bash
# On Acer: Check Tailscale firewall
sudo ufw status
sudo ufw allow 11434/tcp  # If needed

# Test Tailscale connection
tailscale ping 100.107.63.126  # From Acer to Lenovo
```

## Performance Notes

- **nemotron-3-nano** is optimized for speed
- Expect ~20-50 tokens/second depending on Acer GPU
- Streaming makes responses feel instant
- No API rate limits - it's your hardware!

## Privacy Benefits

✅ **100% Local Processing**
- No data sent to external servers
- All AI inference on your Acer machine
- NYPD data stays in your network
- Complete privacy and control

## Files Modified

### Backend:
1. `/app/backend/server.py` - Ollama integration, streaming
2. `/app/backend/requirements.txt` - Removed google-genai
3. `/app/backend/.env` - Ollama configuration
4. `/app/backend/.env.example` - Updated template

### Frontend:
1. `/app/frontend/app/(tabs)/chat.tsx` - Streaming response handling
2. Added AsyncStorage import for token management

## Next Steps

When running locally on your Lenovo laptop:

1. **Ensure both devices are on Tailscale**
   ```bash
   tailscale status  # On both machines
   ```

2. **Start Ollama on Acer**
   ```bash
   ollama serve
   ```

3. **Update `.env` if needed**
   - Verify `OLLAMA_BASE_URL` matches Acer's Tailscale IP
   - Model name is `nemotron-3-nano`

4. **Run the app**
   ```bash
   # Terminal 1: MongoDB
   mongod

   # Terminal 2: Backend
   cd backend
   python -m venv venv
   venv\Scripts\activate
   uvicorn server:app --reload

   # Terminal 3: Frontend
   cd frontend
   yarn web
   ```

5. **Test chat with streaming!**

---

**Your AI is now completely local and private! 🎉**
