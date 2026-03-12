-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Device profiles
CREATE TABLE device_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_fingerprint TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scan sessions
CREATE TABLE scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES device_profiles(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  candidate_count INTEGER NOT NULL DEFAULT 0,
  route_geom GEOMETRY(LINESTRING, 4326)
);

-- Hazard clusters (the canonical hazard table)
CREATE TABLE hazard_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_type TEXT NOT NULL CHECK (hazard_type IN ('pothole','sudden_brake','possible_crash','manual')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  location GEOMETRY(POINT, 4326) NOT NULL,
  radius_meters DOUBLE PRECISION NOT NULL DEFAULT 10,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  detection_count INTEGER NOT NULL DEFAULT 1,
  confirmation_count INTEGER NOT NULL DEFAULT 0,
  rejection_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','disputed')),
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Spatial index on hazard locations
CREATE INDEX hazard_clusters_location_gist ON hazard_clusters USING GIST(location);

-- Hazard candidates (raw detections before clustering)
CREATE TABLE hazard_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scan_sessions(id) ON DELETE SET NULL,
  device_id UUID REFERENCES device_profiles(id) ON DELETE SET NULL,
  hazard_type TEXT NOT NULL CHECK (hazard_type IN ('pothole','sudden_brake','possible_crash')),
  location GEOMETRY(POINT, 4326) NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  speed_kmh DOUBLE PRECISION,
  accel_magnitude DOUBLE PRECISION,
  jerk DOUBLE PRECISION,
  rotation_magnitude DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  cluster_id UUID REFERENCES hazard_clusters(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX hazard_candidates_location_gist ON hazard_candidates USING GIST(location);

-- Hazard validations (confirmations/rejections)
CREATE TABLE hazard_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES hazard_clusters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id UUID REFERENCES device_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('confirm','reject','resolve')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cleanup function for expired candidates
CREATE OR REPLACE FUNCTION cleanup_expired_candidates() RETURNS void AS $$
BEGIN
  DELETE FROM hazard_candidates WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update hazard_clusters.last_updated_at
CREATE OR REPLACE FUNCTION update_cluster_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.last_updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hazard_clusters_updated
  BEFORE UPDATE ON hazard_clusters
  FOR EACH ROW EXECUTE FUNCTION update_cluster_timestamp();

-- RPC to find nearby cluster for deduplication
CREATE OR REPLACE FUNCTION find_nearby_cluster(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_hazard_type TEXT,
  p_radius_m DOUBLE PRECISION DEFAULT 30
) RETURNS TABLE(id UUID, detection_count INTEGER, confidence DOUBLE PRECISION, severity TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT hc.id, hc.detection_count, hc.confidence, hc.severity
  FROM hazard_clusters hc
  WHERE hc.hazard_type = p_hazard_type
    AND hc.status = 'active'
    AND ST_DWithin(
      hc.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY ST_Distance(
    hc.location::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- RPC to query all active hazards within a radius, returning distance
CREATE OR REPLACE FUNCTION hazards_within_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 1000
) RETURNS TABLE(
  id UUID,
  hazard_type TEXT,
  severity TEXT,
  location TEXT,
  confidence DOUBLE PRECISION,
  detection_count INTEGER,
  confirmation_count INTEGER,
  rejection_count INTEGER,
  status TEXT,
  description TEXT,
  evidence_urls TEXT[],
  first_detected_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hc.id,
    hc.hazard_type,
    hc.severity,
    ST_AsText(hc.location) AS location,
    hc.confidence,
    hc.detection_count,
    hc.confirmation_count,
    hc.rejection_count,
    hc.status,
    hc.description,
    hc.evidence_urls,
    hc.first_detected_at,
    hc.last_updated_at,
    hc.expires_at,
    ST_Distance(
      hc.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_meters
  FROM hazard_clusters hc
  WHERE hc.status = 'active'
    AND ST_DWithin(
      hc.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- RPC to query active hazards within a bounding box
CREATE OR REPLACE FUNCTION hazards_in_bbox(
  p_min_lat DOUBLE PRECISION,
  p_min_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION
) RETURNS TABLE(
  id UUID,
  hazard_type TEXT,
  severity TEXT,
  location TEXT,
  confidence DOUBLE PRECISION,
  detection_count INTEGER,
  confirmation_count INTEGER,
  rejection_count INTEGER,
  status TEXT,
  description TEXT,
  evidence_urls TEXT[],
  first_detected_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hc.id,
    hc.hazard_type,
    hc.severity,
    ST_AsText(hc.location) AS location,
    hc.confidence,
    hc.detection_count,
    hc.confirmation_count,
    hc.rejection_count,
    hc.status,
    hc.description,
    hc.evidence_urls,
    hc.first_detected_at,
    hc.last_updated_at,
    hc.expires_at
  FROM hazard_clusters hc
  WHERE hc.status = 'active'
    AND hc.location && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  ORDER BY hc.last_updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC to increment confirmation count
CREATE OR REPLACE FUNCTION increment_confirmation(p_cluster_id UUID) RETURNS void AS $$
BEGIN
  UPDATE hazard_clusters
  SET confirmation_count = confirmation_count + 1
  WHERE id = p_cluster_id;
END;
$$ LANGUAGE plpgsql;

-- RPC to increment rejection count
CREATE OR REPLACE FUNCTION increment_rejection(p_cluster_id UUID) RETURNS void AS $$
BEGIN
  UPDATE hazard_clusters
  SET rejection_count = rejection_count + 1
  WHERE id = p_cluster_id;
END;
$$ LANGUAGE plpgsql;
