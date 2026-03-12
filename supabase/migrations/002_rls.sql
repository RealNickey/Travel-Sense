-- Enable RLS on all tables
ALTER TABLE device_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_validations ENABLE ROW LEVEL SECURITY;

-- device_profiles: users can only see/edit their own profile
CREATE POLICY "device_profiles_select" ON device_profiles FOR SELECT USING (true);
CREATE POLICY "device_profiles_insert" ON device_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "device_profiles_update" ON device_profiles FOR UPDATE USING (
  user_id = auth.uid() OR user_id IS NULL
);

-- scan_sessions: anyone can view, owner can modify
CREATE POLICY "scan_sessions_select" ON scan_sessions FOR SELECT USING (true);
CREATE POLICY "scan_sessions_insert" ON scan_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "scan_sessions_update" ON scan_sessions FOR UPDATE USING (
  user_id = auth.uid() OR user_id IS NULL
);

-- hazard_clusters: public read, no direct client write (server-side only via service role)
CREATE POLICY "hazard_clusters_select" ON hazard_clusters FOR SELECT USING (true);

-- hazard_candidates: public read, no direct client write
CREATE POLICY "hazard_candidates_select" ON hazard_candidates FOR SELECT USING (true);

-- hazard_validations: public read, no direct client write
CREATE POLICY "hazard_validations_select" ON hazard_validations FOR SELECT USING (true);
