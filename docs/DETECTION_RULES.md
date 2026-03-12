# Detection Rules Documentation

## Overview

Travel-Sense uses a rule-based classifier to detect road hazards from device sensor data. The pipeline processes `DeviceMotionEvent` readings and GPS data.

## Sensor Inputs

| Field | Unit | Description |
|-------|------|-------------|
| `ax` | m/s² | Linear acceleration X |
| `ay` | m/s² | Linear acceleration Y |
| `az` | m/s² | Linear acceleration Z (includes gravity ~9.8) |
| `gx` | rad/s | Rotation rate alpha |
| `gy` | rad/s | Rotation rate beta |
| `gz` | rad/s | Rotation rate gamma |
| `speed` | m/s | GPS-derived speed |
| `accuracy` | m | GPS accuracy estimate |

## Derived Features

| Feature | Formula | Description |
|---------|---------|-------------|
| `accelMagnitude` | `√(ax²+ay²+az²)` | Total acceleration magnitude |
| `jerk` | `Δacceleration / Δtime` | Rate of acceleration change |
| `verticalSpike` | `|az - 9.8|` | Deviation from gravity (vertical shock) |
| `rotationMagnitude` | `√(gx²+gy²+gz²)` | Total rotation rate |
| `speedChange` | `Δspeed / Δtime` | Rate of speed change (deceleration) |

## Preprocessing

Samples are smoothed using a 3-sample moving average window on acceleration and gyroscope axes before feature extraction to reduce sensor noise.

## Classification Rules

### 1. Pothole Detection

**Priority:** Low (checked after crash)

**Conditions (ALL must be true):**
- `verticalSpike >= 4.0 m/s²` — significant vertical shock
- `jerk >= 30.0 m/s³` — rapid change in acceleration
- `speed >= 2.0 m/s` — moving at least ~7 km/h

**Severity:**
- `verticalSpike >= 8.0` → `high`
- `verticalSpike >= 6.0` → `medium`
- Otherwise → `low`

### 2. Sudden Brake Detection

**Priority:** Low (checked last)

**Conditions (ALL must be true):**
- `speedChange >= 3.0 m/s²` — strong deceleration
- `speed >= 3.0 m/s` — was moving at least ~11 km/h

**Severity:**
- `speedChange >= 8.0` → `high`
- Otherwise → `medium`

### 3. Possible Crash Detection

**Priority:** Highest (checked first)

**Conditions (ALL must be true):**
- `accelMagnitude >= 25.0 m/s²` — massive impact force
- `rotationMagnitude >= 3.0 rad/s` — significant rotation
- `speedChange >= 5.0 m/s²` — rapid deceleration

**Severity:**
- `confidence > 0.8` → `critical`
- Otherwise → `high`

## Confidence Scoring

Confidence is computed from 0.0 to 1.0 based on:

1. **Pothole:** `(spikeScore × 0.5) + (jerkScore × 0.3) + (gpsScore × 0.2)`
2. **Sudden Brake:** `(brakeScore × 0.7) + (gpsScore × 0.3)`
3. **Possible Crash:** `(accelScore × 0.4) + (rotScore × 0.3) + (gpsScore × 0.3)`

GPS accuracy factor:
- `< 10m` → 1.0
- `10-25m` → 0.8
- `25-50m` → 0.6
- `> 50m` → 0.4

## Debouncing

To prevent duplicate reports from the same physical event:

- **Time window:** 3,000 ms per hazard type
- **Distance window:** 20 meters radius

A detection is suppressed if there was a detection of the same type within the time AND distance windows.

## Server-Side Clustering

When a candidate is submitted to the API:

1. PostGIS `find_nearby_cluster()` searches for existing clusters of the same type within **30 meters**
2. If found: `detection_count++`, `confidence += 0.05` (capped at 1.0), severity upgraded if new detection is higher
3. If not found: create new `hazard_cluster` with the candidate's confidence and severity

Clusters expire based on the `expires_at` field; expired candidates are cleaned up by `cleanup_expired_candidates()`.
