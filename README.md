# Travel-Sense

Travel-Sense is a mobile-first Progressive Web App (PWA) designed to detect road hazards in real time using device motion sensors (accelerometer, gyroscope) and GPS location. Detections are automatically ingested, clustered spatially using PostGIS, and mapped to provide real-time hazard alerts and safety scores for drivers and commuters.

---

## 🚀 Features

- **Automated Sensor Detection**: Uses `DeviceMotionEvent` and GPS data to automatically classify potholes, sudden braking, and potential crash events.
- **Real-Time Interactive Hazard Map**: Renders active hazard clusters on Google Maps with real-time updates via Supabase Realtime channels.
- **Dynamic Safety Score**: Computes real-time location safety scores (0–100) based on nearby hazard severity, cluster confidence, community validation, recency decay, and spatial distance.
- **Offline-First Support**: Queues sensor detections locally via `OfflineQueue` when offline and automatically flushes and syncs when connectivity is restored.
- **Manual Reporting & Evidence**: Allows users to manually report hazards and upload supporting media/photo evidence.
- **Community Validation**: Enables users to confirm, reject, or mark hazards as resolved to maintain accurate community hazard data.

---

## 🏗️ Architecture & Tech Stack

### Tech Stack

- **Framework**: Next.js 15 (App Router) & React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS & PostCSS
- **Database & Backend**: Supabase (PostgreSQL + PostGIS, Realtime, Storage)
- **Mapping**: `@googlemaps/js-api-loader`
- **PWA**: `@ducanh2912/next-pwa`
- **Testing**: Jest & `@testing-library/react`

### System Layers

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  Next.js App Router (React 18, TypeScript)          │
│  Components: HazardMap, ScanControls, DetectionFeed │
│  PWA: Service Worker, Offline Queue (localStorage)  │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP / Supabase Realtime
┌──────────────────▼──────────────────────────────────┐
│                   API Layer                          │
│  Next.js Route Handlers (app/api/)                  │
│  - POST /api/sessions         (Session creation)    │
│  - POST /api/candidates       (Hazard ingestion)    │
│  - GET  /api/hazards          (Hazard retrieval)    │
│  - POST /api/hazards/[id]/validate                  │
│  - POST /api/hazards/report   (Manual reports)      │
│  - GET  /api/safety-score     (Risk scoring)        │
│  - POST /api/evidence         (Upload signed URLs)  │
└──────────────────┬──────────────────────────────────┘
                   │ Service Role Client
┌──────────────────▼──────────────────────────────────┐
│               Data Layer (Supabase)                  │
│  PostgreSQL + PostGIS                               │
│  Tables: device_profiles, scan_sessions,            │
│          hazard_clusters, hazard_candidates,        │
│          hazard_validations                         │
└─────────────────────────────────────────────────────┘
```

---

## ⚡ Sensor Pipeline & Detection Rules

Sensor readings undergo a multi-stage detection pipeline:

1. **Preprocessing (`smoothSamples`)**: Moving average filter (window size = 3) applied to sensor axes to reduce noise.
2. **Feature Extraction (`extractFeatures`)**: Derives magnitude, jerk, vertical spike deviation (`|az - 9.8|`), rotation magnitude, and rate of speed change.
3. **Classification (`classify`)**:
   - **Pothole**: `verticalSpike >= 4.0 m/s²`, `jerk >= 30.0 m/s³`, `speed >= 2.0 m/s`.
   - **Sudden Brake**: `speedChange >= 3.0 m/s²`, `speed >= 3.0 m/s`.
   - **Possible Crash**: `accelMagnitude >= 25.0 m/s²`, `rotationMagnitude >= 3.0 rad/s`, `speedChange >= 5.0 m/s²`.
4. **Debouncing (`DetectionDebouncer`)**: Suppresses repetitive duplicate detections within 3 seconds and 20 meters.
5. **Spatial Clustering (PostGIS)**: Server-side RPC `find_nearby_cluster()` groups detections within 30 meters.

---

## 📡 API Reference Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions` | Starts a new scan session |
| `POST` | `/api/sessions/[id]/end` | Ends an active scan session |
| `POST` | `/api/candidates` | Ingests sensor detection candidates |
| `GET`  | `/api/hazards` | Retrieves hazard clusters by radius or bounding box |
| `POST` | `/api/hazards/[id]/validate` | Confirms, rejects, or resolves a hazard cluster |
| `POST` | `/api/hazards/report` | Submits a manual hazard report |
| `GET`  | `/api/safety-score` | Calculates location risk and safety score |
| `POST` | `/api/evidence` | Generates signed storage upload URLs for evidence |

For detailed payloads and request parameters, consult [`docs/API.md`](docs/API.md).

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Supabase project (PostgreSQL + PostGIS enabled)
- Google Maps API key (Maps JavaScript API enabled)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

Run unit tests with Jest:

```bash
npm test
```

Tests cover sensor preprocessing, classification rules, debouncing, offline queueing, and safety score calculations.

---

## 📂 Project Structure

```
.
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # Backend API route handlers
│   ├── layout.tsx        # Main application layout
│   └── page.tsx          # Main dashboard view
├── components/           # React UI components (Map, Feed, Controls, Score)
├── lib/                  # Core libraries (Detection, Offline Queue, Scoring, Supabase)
├── docs/                 # Detailed architecture & API documentation
├── __tests__/            # Jest unit test suites
└── supabase/             # Database migrations and schema setup
```

---

## 📄 Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Detection Rules](docs/DETECTION_RULES.md)
