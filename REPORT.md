# Hack_Yard demo: project report

**Problem statement:** Critical Infrastructure Under Environmental Stress

## 1. The problem

Roads, bridges, power lines, hospitals and other essential facilities are damaged or cut off during floods,
landslides and extreme heat. Cities usually know *where* these assets are. What they lack is a clear picture of
*which* ones will be affected as conditions change, *how badly*, and *what else fails* as a result.

**Hack_Yard demo** answers three questions for any city, using only free and open data:

1. Which assets are at risk in the next 72 hours, and why?
2. If one fails, what else goes down with it?
3. With a limited budget and crews, where should we act first?

## 2. Existing solutions and the gap

| Existing solution | What it does | What it does not do |
|---|---|---|
| Google Flood Hub, GloFAS (Copernicus) | River flood forecasts | Says where water rises, not which assets are hit |
| IMD / NDMA SACHET alerts | District-level weather warnings | No asset-level or impact view |
| ISRO Bhuvan, Copernicus EMS | Satellite maps during and after a disaster | Reactive, not preventive |
| FEMA Hazus, CDRI GIRI | Loss and risk modelling | Offline, expert-only, not live |
| City GIS portals | Asset locations | Static; do not react to weather |

**The gap:** no single tool joins live hazard, asset vulnerability, knock-on impact and a prioritised action
list. That combination is what this prototype provides.

## 3. Features

### Carried over from the earlier prototype
Hazard modelling, asset risk scoring, cascade analysis, action plan, situation brief and scenario presets.
All were rebuilt on live data.

### New in this prototype
| Feature | What it does |
|---|---|
| Any-city search | Type any city; assets, terrain and forecast are fetched live and scored |
| Live risk feed | Forecast refreshes every 15 minutes and open screens update over a WebSocket |
| Time selector | Risk for the next 24 hours, or the 24 hours starting +24h, +48h, +72h |
| Explainable score | Every asset lists the hazards behind its score and the reason for each |
| Cascade simulator | Fail assets on the map and watch dependent assets go down, step by step |
| Hospital isolation check | Flags hospitals whose mapped access routes are all at high risk |
| Stress tests | Cloudburst, river flood, heatwave and cyclone presets applied to the real city |
| Budget-constrained action plan | Ranks preventive actions by risk removed per rupee within a budget and crew limit |
| Safe route | Driving route to the nearest hospital that is not at risk, warning about at-risk roads and bridges |
| Citizen reports | Users report issues on a map; an admin verifies them; verified reports raise nearby scores |
| Alerts | Admin sends advisories, warnings and emergencies; users receive them instantly |
| Situation brief | Plain-language summary for officials, and a public advisory for users; saves as PDF |
| Satellite layer | Daily NASA imagery on the map, with a date picker for before/after comparison |
| Audit log | Records logins, city loads, alerts, report reviews and role changes |

## 4. Roles and access

One administrator and one normal user are created on first run. Anyone can self-register and becomes a normal
user; only an administrator can promote an account. Access is enforced by the backend on every request, not
just hidden in the interface.

| Feature | Administrator | Normal user |
|---|---|---|
| Dashboard | Full detail, asset table, isolation warnings | Simplified status and latest alerts |
| Live map | Four risk levels, score and explanation per asset | Safe / caution / danger only |
| Assets table, asset explanation | Yes | No |
| Cascade simulator, scenarios, action plan | Yes | No |
| Brief | Full situation brief with actions | Public advisory |
| Alerts | Create and delete | Read |
| Citizen reports | See all, verify or reject | Submit, see own |
| Safe route | Yes | Yes |
| Users, settings, audit log, refresh forecast | Yes | No |

**Demo credentials** (defined in `backend/app/config.py`, shown as buttons on the login page):

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@hackyard.demo` | `Admin@12345` |
| Normal user | `user@hackyard.demo` | `User@12345` |

## 5. Screen flow and layout

1. `http://localhost:3000` always opens the **login / sign-up** screen first.
2. After signing in, the app opens with the name **Hack_Yard demo** at the top of the left sidebar.
3. The **left sidebar is fixed** to the screen height and does not scroll; only the content area scrolls.
4. The sidebar tabs depend on the role:
   - **Administrator:** Dashboard, Live Map, Assets · Cascade Simulator, Scenarios, Action Plan · Alerts,
     Reports, AI Brief, Safe Route · Users, Settings
   - **Normal user:** Dashboard, Live Map · Alerts, Safe Route, Advisory · Report an Issue
5. The top bar holds the welcome line with a role badge, the city search, the time selector and the alerts bell.

**Design:** based on the supplied reference (dark navy panels, purple accent, rounded cards, grouped sidebar).
The dashboard mirrors its layout: five risk tiles, a score gauge, a trend chart, a donut and a details table.

**Added effects:** the active-tab pill slides between tabs; tabs and cards glow on hover; Alerts and Reports
show count badges; a pulsing dot shows the live connection; tile numbers count up; loading uses skeleton
placeholders; all motion switches off when the device asks for reduced motion.

## 6. Tech stack (everything is free)

| Layer | Technology | Where it is used |
|---|---|---|
| Frontend framework | Next.js 16 (App Router), React 19, TypeScript | Every screen; runs on `localhost:3000` |
| Styling | Tailwind CSS 4 with custom theme tokens | Layout and the dark theme |
| Maps | MapLibre GL 5 with the OpenFreeMap dark basemap | Live map, cascade, reports, safe route |
| Charts | Recharts 3, plus a hand-drawn SVG gauge | Dashboard |
| Animation, icons | Motion, Lucide | Sliding tab pill, list reveals, icons |
| Backend | FastAPI on Python 3.12, served by Uvicorn | REST API and WebSocket on `localhost:8000` |
| Authentication | JWT in an httpOnly cookie, Argon2 password hashing, `role` on each user | Login, sign-up, role checks |
| Database | SQLite through SQLAlchemy 2 (one file, `backend/hackyard.db`) | Users, cities, assets, links, alerts, reports, audit log |
| Risk engine | Plain Python, NetworkX for the dependency graph | Scoring, cascade, action plan |
| Scheduler | A background asyncio task inside FastAPI | Refreshes each city's forecast every 15 minutes |
| Brief | Google Gemini free tier if a key is set; otherwise a built-in template | AI Brief / Advisory |

### How the pieces connect

```
Browser ──HTTP──> Next.js (3000) ──/api/* proxied──> FastAPI (8000) ──> SQLite
   │                                                      │
   └────────── WebSocket ws://localhost:8000/ws/live ─────┘
                                                          │
                     Open-Meteo, OpenStreetMap, OSRM  <───┘ (fetched by the backend)
```

- The browser only calls its own origin. Next.js forwards `/api/*` to FastAPI, so the login cookie is
  first-party and no cross-origin setup is needed.
- The WebSocket carries only "something changed" signals. Screens then refetch through the authenticated API,
  so no data leaks over the socket.
- The backend is the only part that talks to external data services.

### Backend modules

| File | Responsibility |
|---|---|
| `app/main.py` | App start-up, demo account seeding, forecast refresh loop, WebSocket endpoint |
| `app/auth.py`, `routers/auth.py` | Password hashing, tokens, login, sign-up, role guards |
| `services/citydata.py` | Geocoding, OpenStreetMap assets, elevation and slope, forecast, inferred dependencies |
| `services/risk.py` | Hazard intensity, exposure, vulnerability, asset and city scores, stress tests |
| `services/cascade.py` | Dependency graph and knock-on failure simulation |
| `services/plan.py` | Action catalogue and the budget and crew prioritiser |
| `services/routing.py` | Safe route to a hospital |
| `services/brief.py` | Situation brief and public advisory |
| `routers/city.py`, `community.py`, `admin.py` | API endpoints for risk, alerts and reports, users and audit |

### Free data sources (no API key for any of them)

| Data | Source |
|---|---|
| City search | Open-Meteo Geocoding |
| Hospitals, fire stations, substations, power plants, water facilities, bridges, main roads, waterways | OpenStreetMap via the Overpass API |
| Elevation and slope | Open-Meteo Elevation (Copernicus DEM, 90 m) |
| Rain, feels-like temperature, wind gusts | Open-Meteo Forecast |
| River discharge | Open-Meteo Flood (GloFAS), compared with its own 90-day median |
| Basemap | OpenFreeMap |
| Satellite imagery | NASA GIBS (MODIS Terra true colour, daily) |
| Driving routes | OSRM public server |

## 7. How the risk score works

For each asset and each hazard:

```
risk = intensity (from the forecast) × exposure (from terrain) × vulnerability (from asset type)
```

| Hazard | Intensity comes from | Exposure comes from |
|---|---|---|
| Flood | 24-hour rain, previous 72-hour rain, river discharge vs normal | How low the site is relative to the city, flatness, distance to a waterway |
| Heat | Maximum feels-like temperature (starts at 34 °C, saturates at 48 °C) | City-wide |
| Landslide | 24-hour and previous rain | Slope at the site |
| Wind | Maximum gust (starts at 45 km/h) | City-wide |

The four hazards combine into an asset score of 0 to 100 (low under 20, moderate under 45, high under 70,
critical above). The city score of 0 to 1000 blends the weighted average with the worst tenth of assets, so
a handful of critical assets still shows. Every score lists its contributing factors in plain words.

**Cascade:** hospitals, water facilities and fire stations are linked to their nearest substation; hospitals
to their nearest water facility and two nearest main roads or bridges. Failing an asset propagates along
these links (for example a substation failure stops a water facility, which degrades a hospital).

**Action plan:** each at-risk asset gets an action matched to its type and main hazard, with an indicative
cost and crew need. Actions are ranked by benefit per rupee, where benefit is risk removed × criticality ×
number of dependent assets, then selected until the budget or crews run out.

## 8. Verified on localhost

Tested against live data for Pune and Kochi:

- Login, sign-up validation, demo buttons, wrong-password and no-session rejection.
- A normal user receives 403 on every administrator endpoint and a simplified payload elsewhere.
- City load through the search box (Pune about 34 s, 165 assets; Kochi 140 assets).
- Dashboard, map, assets, scenarios, cascade, action plan, brief, alerts, reports, users and settings render
  without browser errors.
- Stress test: Cloudburst raises Pune from 32 to 574 out of 1000; cascade of critical bridges reduces access
  to two hospitals.
- A verified citizen report raised the score of the two assets within 400 m.
- Safe route returns a hospital, distance and time from a clicked point.

Not tested: the Gemini-written brief (no key was configured; the template path was used) and the
"Use my location" buttons (they need browser location permission).

## 9. Known limits

- **Dependency links are estimates** from proximity, because OpenStreetMap does not record which substation
  feeds which hospital. The interface labels them as estimated.
- **Costs, crew numbers and people-served figures are planning assumptions**, not surveyed values.
- **Risk weights are expert-style heuristics**, not calibrated against past damage records.
- **Area and asset caps:** 7 km around the city centre by default (15 km maximum) and up to 40 assets per
  type, to keep a new city within about a minute. Roads appear as one point per named road.
- **OpenStreetMap coverage varies:** small towns show fewer assets. The free Overpass servers are sometimes
  busy; the app retries three mirrors and then asks you to try again.
- **Satellite layer is coarse** (about 250 m per pixel) and shows cloud on cloudy days. It is context, not
  flood detection.
- **Safe route** checks roads against at-risk assets near the route; it does not model water depth.

## 10. Changes from the first plan

| Planned | Built | Why |
|---|---|---|
| PostgreSQL with PostGIS | SQLite | Runs with zero setup on localhost; `DATABASE_URL` switches to Postgres for deployment |
| shadcn/ui, deck.gl | Hand-written components, MapLibre layers | Fewer dependencies; nothing needed them |
| APScheduler | asyncio background task | Same result with no extra package |
| CARTO basemap | OpenFreeMap | CARTO tiles now require an API key |
| MapLibre GL 6 | MapLibre GL 5 | Version 6's worker did not load under Next.js's bundler |
| SQLAlchemy latest | SQLAlchemy 2.0.x | Windows App Control blocked the newer version's compiled file on this machine |

## 11. Presentation slides

1. **Title:** Hack_Yard demo, team, one-line pitch
2. **Problem:** cities know where assets are, not which will fail
3. **Existing solutions and the gap** (table from section 2)
4. **Our solution in one picture:** live data → risk score → cascade → action plan
5. **Live demo: login and roles** (administrator vs normal user)
6. **Dashboard and live map:** any city, explainable scores, 72-hour outlook
7. **Cascade simulator:** fail a bridge or substation, watch hospitals lose access or power
8. **Stress tests and action plan:** cloudburst scenario, budget-limited priorities
9. **Citizen side:** alerts, safe route, report an issue, public advisory
10. **Architecture and free data sources** (diagram from section 6)
11. **What is unique and the impact:** asset-level, preventive, explainable, zero cost
12. **Limits, roadmap and deployment plan**

## 12. Next steps

- Calibrate the risk weights against recorded flood and outage events.
- Replace inferred dependency links with utility data where a city can supply it.
- Add Sentinel-1 radar flood-extent detection for true before/after flood mapping.
- Deployment (to be decided): hosted Postgres, backend and frontend hosting, secure WebSocket, real secrets.
