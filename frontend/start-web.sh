#!/bin/bash
cd /app/frontend
export PORT=3000
exec npx expo start --web --port 3000
