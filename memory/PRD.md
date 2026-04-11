# Agentic Safeguard - Product Requirements Document

## Overview
Agentic Safeguard is an AI-powered NYC safety intelligence mobile app that helps users assess and navigate safety risks across New York City using real NYPD shooting incident data (2006-Present), community reports, and AI analysis.

## Tech Stack
- **Frontend**: React Native / Expo SDK 54 with Expo Router
- **Backend**: FastAPI (Python) with MongoDB
- **AI**: Gemini 3 Flash via Emergent LLM Key
- **Map**: Leaflet.js with CartoDB Dark Matter tiles
- **Payments**: Stripe (emergentintegrations)
- **Data**: NYC OpenData SODA API (5,000 shooting records)
- **Auth**: JWT-based (bcrypt + access/refresh tokens)

## Features

### 1. Interactive Shooting Heatmap (Map Tab)
- Full-screen dark-themed map with shooting density heatmap
- Location search with Nominatim geocoding
- Tap-to-analyze for AI safety assessments
- Safety modal: rating (1-10), risk level, recommendations, best/avoid times

### 2. AI Safety Agent Chat (Agent Tab)
- Gemini 3 Flash conversational AI
- Context-aware safety assessments based on NYPD data
- Pre-built safety prompts

### 3. Community Incident Reports (Reports Tab) - NEW
- 8 report categories: shooting, assault, robbery, suspicious activity, theft, vandalism, harassment, other
- Photo uploads (base64) with image picker
- Upvote/downvote system for report verification
- Category filtering
- Auto-notifications to users with nearby plans
- Reports visible on map overlay

### 4. Safety-Aware Plans (Plans Tab)
- Manual event creation with auto-geocoding
- Automatic AI safety analysis per plan
- Color-coded risk badges
- Google Calendar integration (premium feature)

### 5. Premium Subscription (Profile) - NEW
- **Free Tier**: 5 safety analyses/day, basic features
- **Premium ($9.99/mo)**: Unlimited analyses, Google Calendar, priority support
- Stripe Checkout integration
- Visual limit tracker for free users

### 6. Notifications System (Profile) - NEW
- In-app notification center
- Types: community reports, calendar digest, subscription, safety alerts
- Unread badge on Profile tab
- Mark all read functionality
- Push token registration for mobile

### 7. Google Calendar Integration (Profile) - NEW
- OAuth2 flow for Google Calendar connection (requires credentials)
- Auto-analyze daily calendar events for safety
- Premium-only feature
- Connect/disconnect from Profile

### 8. Profile & Statistics
- User info with tier badge (FREE/PREMIUM)
- Borough shooting statistics
- Time-of-day distribution
- Analysis limit tracker
- Settings and logout

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |

### Safety & Data
| POST | /api/safety/analyze | AI safety analysis (rate limited) |
| GET | /api/safety/limit | Get analysis usage/limit |
| GET | /api/shootings | Get shooting data |
| GET | /api/shootings/heatmap | Heatmap points |

### Community Reports
| POST | /api/reports | Create report |
| GET | /api/reports | List reports (filterable) |
| GET | /api/reports/nearby | Nearby reports |
| GET | /api/reports/map-data | Map overlay data |
| POST | /api/reports/{id}/vote | Vote on report |
| DELETE | /api/reports/{id} | Delete own report |

### Premium
| POST | /api/subscription/checkout | Start Stripe checkout |
| GET | /api/subscription/status/{id} | Check payment status |
| POST | /api/webhook/stripe | Stripe webhook |

### Calendar
| GET | /api/calendar/status | Check calendar config |
| GET | /api/calendar/auth-url | Get OAuth URL |
| GET | /api/calendar/callback | OAuth callback |
| GET | /api/calendar/events | Get calendar events |
| POST | /api/calendar/analyze-day | Analyze today's events |
| DELETE | /api/calendar/disconnect | Disconnect calendar |

### Notifications
| GET | /api/notifications | Get notifications |
| POST | /api/notifications/mark-read | Mark all read |
| POST | /api/notifications/register-token | Register push token |

## Configuration
- Google Calendar requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend .env
- Stripe uses sk_test_emergent (pre-configured)
- Admin seeded as premium tier
