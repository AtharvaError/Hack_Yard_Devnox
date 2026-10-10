# InfraSentinel

Live infrastructure risk intelligence for any city. It scores hospitals, roads, bridges, power and water assets
against the live weather forecast, shows what fails next when one asset goes down, and ranks where to act first.

The full write-up (problem, existing solutions, features, tech stack, slides) is in [REPORT.md](REPORT.md).

## Run it on localhost

Needs Python 3.12 and Node.js 20 or newer. No API keys, no paid services, no Docker.

**One command (Windows PowerShell):**

```powershell
.\start.ps1
```

**Or by hand, in two terminals:**

```powershell
# Terminal 1: backend on http://localhost:8000
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

```powershell
# Terminal 2: frontend on http://localhost:3000
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The first screen is the login page.

**If ports 8000 or 3000 are already used by another project,** pick two free ones:

```powershell
.\start.ps1 -ApiPort 8100 -WebPort 3100
```

Then open <http://localhost:3100>. By hand, the equivalent is `--port 8100` for the backend, and for the
frontend `$env:NEXT_PUBLIC_API_PORT = '8100'` followed by `npm run dev -- --port 3100`.

## Demo accounts

Two accounts are created on first run and shown as one-click buttons on the login page:

| Role          | Email                 | Password      |
|---------------|-----------------------|---------------|
| Administrator | `admin@hackyard.demo` | `Admin@12345` |
| Normal user   | `user@hackyard.demo`  | `User@12345`  |

They are defined in [backend/app/config.py](backend/app/config.py) and can be overridden in `backend/.env`
(see [backend/.env.example](backend/.env.example)). Anyone else can sign up and becomes a normal user.

## Demo dataset (Pune and Kochi)

Pune and Kochi are ready the moment the app starts, with no outside service needed. `backend/demo_data`
holds a snapshot of each city's real OpenStreetMap assets and a **modelled storm day**. These two cities
open in demo mode, so the dashboard, map, cascade simulator and action plan always have risk to show.

- The storm weather is made up for demonstration; the assets, terrain and links are real snapshots.
- A yellow **Demo data** label in the top bar shows when a city is in demo mode.
- An administrator can click that label to switch the city to the live forecast, and click
  **Use demo data** to switch back.
- Every other city uses the live forecast only.

## First use

After signing in, type any city into the search box. A new city takes roughly 20 to 60 seconds to build
(OpenStreetMap, elevation and forecast are fetched live); after that it is cached and opens instantly.
If the free OpenStreetMap servers are busy you will see a message asking you to retry in a minute.

On a calm-weather day most assets will correctly show low risk. Sign in as the administrator and use
**Scenarios** to apply a stress test (cloudburst, river flood, heatwave, cyclone) to see the cascade
simulator and action plan at work.

## Citizen reports with photos

A normal user opens **Report an Issue**, clicks the map, picks the damage type and severity, and attaches
1 to 3 photos. An administrator reviews them under **Reports**.

Every report gets the basic checks (re-used photo, photo taken far away or long ago). To add the AI photo
check, create `backend/.env` containing one line with your own key, then restart the backend:

```
VISION_API_KEY=paste-your-key-here
```

The provider is recognised from the key: `xai-…` is Grok (xAI), `gsk_…` is Groq, `AIza…` is Gemini.
Settings shows which one is active. With a key set, report photos are sent to that provider.
(If only `GEMINI_API_KEY` is set, the photo check uses Gemini too.)

## Optional

- `GEMINI_API_KEY` in `backend/.env` makes the brief AI-written (free tier). Without it a built-in template is used.
- `CITY_RADIUS_KM` (default 7, maximum 15) sets how far around the city centre is analysed.

## Deploying

The app is two programs, so it needs two hosts. Both have a free plan.

| Part | Host | Why |
|---|---|---|
| Frontend (`frontend`) | Vercel | Built for Next.js |
| Backend (`backend`) | Render | Needs a long-running server for the live channel and the 15-minute refresh, which Vercel does not provide |

**1. Backend on Render**

- New > Blueprint, pick this repository. `render.yaml` sets everything up and generates a `JWT_SECRET`.
- Optional: enter `VISION_API_KEY` in the Render dashboard for the AI photo check.
- Note the service address, for example `https://infrasentinel-api.onrender.com`.

**2. Frontend on Vercel**

- Import this repository and set **Root Directory** to `frontend`.
- Add two environment variables, using your Render address:
  - `API_URL` = `https://infrasentinel-api.onrender.com`
  - `NEXT_PUBLIC_WS_URL` = `wss://infrasentinel-api.onrender.com/ws/live`
- Deploy. The browser only talks to the Vercel address; `/api` is forwarded to Render.

**What to expect on the free plans**

- Render's free service sleeps when idle, so the first request after a pause takes about a minute.
- Render's free plan has no permanent disk. Accounts people create, cities they load and report photos
  are lost whenever the service restarts. The demo accounts and the Pune and Kochi demo cities come back
  on every start.
- Loading a brand-new city can take longer than the hosted request limit and fail. Pune and Kochi are
  instant.

**For anything beyond a demo**

- Change the demo passwords and set `DEMO_MODE=false` so they are not shown on the login page.
- Point `DATABASE_URL` at a hosted Postgres (for example Neon's free tier) and add `psycopg[binary]` to
  `backend/requirements.txt`.
- Store report photos in object storage instead of `backend/uploads`.
