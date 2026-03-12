# Travel-Sense Architecture

## Overview

Travel-Sense is a mobile-first PWA that detects road hazards using device sensors and crowdsources hazard data to a shared map.

## Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  Next.js App Router (React 18, TypeScript)          │
│  Components: HazardMap, ScanControls, DetectionFeed │
│  PWA: manifest.json, Service Worker, offline queue  │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP / Supabase Realtime
┌──────────────────▼──────────────────────────────────┐
│                   API Layer                          │
│  Next.js Route Handlers (app/api/)                  │
│  - POST /api/sessions         (session management)  │
│  - POST /api/candidates       (hazard ingestion)    │
│  - GET  /api/hazards          (hazard retrieval)    │
│  - POST /api/hazards/[id]/validate                  │
│  - POST /api/hazards/report   (manual reports)      │
│  - GET  /api/safety-score     (risk scoring)        │
│  - POST /api/evidence         (file uploads)        │
└──────────────────┬──────────────────────────────────┘
                   │ Service Role Client
┌──────────────────▼──────────────────────────────────┐
│               Data Layer (Supabase)                  │
│  PostgreSQL + PostGIS                               │
│  Tables: device_profiles, scan_sessions,            │
│          hazard_clusters, hazard_candidates,        │
│          hazard_validations                         │
│  Realtime: hazard_clusters channel                  │
│  Storage: evidence bucket                           │
└─────────────────────────────────────────────────────┘
```

## Detection Pipeline

```
DeviceMotion events
       │
       ▼
SensorSample (ax,ay,az,gx,gy,gz,lat,lng,speed,accuracy)
       │
       ▼
smoothSamples() — moving average filter (window=3)
       │
       ▼
extractFeatures() — accelMagnitude, jerk, verticalSpike,
                    rotationMagnitude, speedChange
       │
       ▼
classify() — rule-based: pothole / sudden_brake / possible_crash
       │
       ▼
DetectionDebouncer — suppress duplicates within 3s / 20m
       │
       ▼
DetectionCandidate → POST /api/candidates
                      OR enqueue offline
```

## Offline Support

When the device is offline, detections are stored in `localStorage` via `OfflineQueue`. On reconnection, `flushOfflineQueue()` uploads queued items in batches.

## Clustering

Server-side: when a new detection arrives, `find_nearby_cluster()` PostGIS RPC checks for existing clusters within 30 meters of the same hazard type. If found, it updates the cluster's `detection_count` and `confidence`. Otherwise, a new cluster is created.

## Safety Score

`computeSafetyScore()` takes nearby hazard clusters and computes a weighted risk score:

- Severity weight: critical=1.0, high=0.7, medium=0.4, low=0.2
- Confidence weight: from cluster confidence field
- Validation weight: +10% per confirmation (max +50%)
- Recency weight: exponential decay with 24h half-life
- Distance weight: linear decay from center to radius edge

Score = 100 × (1 - normalizedRisk), clamped to 0-100.
