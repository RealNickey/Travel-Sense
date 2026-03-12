-- Fix mutable search_path on all public functions (OWASP / Supabase security lint)
CREATE OR REPLACE FUNCTION cleanup_expired_candidates()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM hazard_candidates WHERE expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION update_cluster_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.last_updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION find_nearby_cluster(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_hazard_type TEXT,
  p_radius_m DOUBLE PRECISION DEFAULT 30
)
RETURNS TABLE(id UUID, detection_count INTEGER, confidence DOUBLE PRECISION, severity TEXT)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
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
$$;

CREATE OR REPLACE FUNCTION hazards_within_radius(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE(
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
)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
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
$$;

CREATE OR REPLACE FUNCTION hazards_in_bbox(
  p_min_lat DOUBLE PRECISION,
  p_min_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION
)
RETURNS TABLE(
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
)
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
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
$$;

CREATE OR REPLACE FUNCTION increment_confirmation(p_cluster_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE hazard_clusters
  SET confirmation_count = confirmation_count + 1
  WHERE id = p_cluster_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_rejection(p_cluster_id UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE hazard_clusters
  SET rejection_count = rejection_count + 1
  WHERE id = p_cluster_id;
END;
$$;

-- Stricter INSERT policies: enforce non-trivial checks so WITH CHECK is not always-true
DROP POLICY IF EXISTS "device_profiles_insert" ON device_profiles;
CREATE POLICY "device_profiles_insert" ON device_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(trim(device_fingerprint)) > 0);

DROP POLICY IF EXISTS "scan_sessions_insert" ON scan_sessions;
CREATE POLICY "scan_sessions_insert" ON scan_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (device_id IS NOT NULL);

-- spatial_ref_sys is a PostGIS-owned table; we cannot enable RLS on it.
-- Revoke API access from client roles as a compensating control.
REVOKE SELECT ON spatial_ref_sys FROM anon;
REVOKE SELECT ON spatial_ref_sys FROM authenticated;
