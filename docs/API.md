# Travel-Sense API Documentation

All API routes are under `/api/`. Routes that modify data use the Supabase service role client.

---

## POST /api/sessions

Start a new scan session.

**Request Body:**
```json
{
  "deviceFingerprint": "string (1-200 chars, required)",
  "userId": "UUID (optional)"
}
```

**Response 201:**
```json
{
  "sessionId": "UUID",
  "deviceId": "UUID"
}
```

---

## POST /api/sessions/[id]/end

End an active scan session.

**Response 200:**
```json
{ "success": true }
```

---

## POST /api/candidates

Ingest one or more hazard detection candidates.

**Request Body:**
```json
{
  "candidates": [
    {
      "hazardType": "pothole" | "sudden_brake" | "possible_crash",
      "confidence": 0.0-1.0,
      "severity": "low" | "medium" | "high" | "critical",
      "timestamp": 1234567890123,
      "lat": -90.0 to 90.0,
      "lng": -180.0 to 180.0,
      "speed": 0+,
      "accuracy": 0+,
      "features": {
        "accelMagnitude": number,
        "jerk": number,
        "verticalSpike": number,
        "rotationMagnitude": number,
        "speedChange": number
      },
      "reasoning": ["string"]
    }
  ],
  "sessionId": "UUID (optional)",
  "deviceFingerprint": "string (1-200 chars, required)"
}
```

**Response 200:**
```json
{
  "success": true,
  "inserted": [{ "candidateId": "UUID", "clusterId": "UUID" }]
}
```

---

## GET /api/hazards

Retrieve hazard clusters.

**Query Parameters:**
- Radius mode: `lat`, `lng`, `radius` (default: 1000m)
- BBox mode: `minLat`, `minLng`, `maxLat`, `maxLng`
- No params: returns up to 200 active hazards

**Response 200:**
```json
{
  "hazards": [
    {
      "id": "UUID",
      "hazard_type": "pothole",
      "severity": "medium",
      "location": "POINT(lng lat)",
      "confidence": 0.75,
      "detection_count": 3,
      "confirmation_count": 1,
      "rejection_count": 0,
      "status": "active",
      "first_detected_at": "ISO8601",
      "last_updated_at": "ISO8601"
    }
  ]
}
```

---

## POST /api/hazards/[id]/validate

Confirm, reject, or resolve a hazard cluster.

**Request Body:**
```json
{
  "action": "confirm" | "reject" | "resolve",
  "deviceFingerprint": "string (optional)",
  "userId": "UUID (optional)"
}
```

**Response 200:**
```json
{ "success": true }
```

---

## POST /api/hazards/report

Manually report a hazard at current location.

**Request Body:**
```json
{
  "type": "pothole" | "sudden_brake" | "possible_crash" | "manual",
  "severity": "low" | "medium" | "high" | "critical",
  "lat": number,
  "lng": number,
  "description": "string (optional, max 1000)",
  "evidenceUrls": ["string"] (optional, max 10),
  "deviceFingerprint": "string (optional)"
}
```

**Response 201:**
```json
{ "success": true, "clusterId": "UUID" }
```

---

## GET /api/safety-score

Compute safety score for a location.

**Query Parameters:**
- `lat` (required)
- `lng` (required)
- `radius` (optional, default: 500m)

**Response 200:**
```json
{
  "score": 85,
  "riskLevel": "low",
  "hazardCount": 2,
  "weightedRisk": 1.5234,
  "contributing": [
    { "weight": 0.0842, "severity": "medium" }
  ]
}
```

---

## POST /api/evidence

Get a signed upload URL for evidence files.

**Request Body:**
```json
{
  "fileName": "photo.jpg",
  "contentType": "image/jpeg"
}
```

**Response 200:**
```json
{
  "uploadUrl": "https://...",
  "filePath": "evidence/...",
  "token": "..."
}
```
