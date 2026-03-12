import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { computeSafetyScore, HazardForScoring } from '@/lib/scoring/safety-score';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '500');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('hazards_within_radius', {
    p_lat: lat,
    p_lng: lng,
    p_radius_m: radius,
  });

  if (error) {
    // Fallback: return perfect score if DB query fails
    return NextResponse.json({ score: computeSafetyScore([]) });
  }

  const hazards: HazardForScoring[] = (data ?? []).map((h: Record<string, unknown>) => ({
    severity: h.severity as string,
    confidence: h.confidence as number,
    confirmationCount: (h.confirmation_count as number) ?? 0,
    detectionCount: (h.detection_count as number) ?? 1,
    lastUpdatedAt: (h.last_updated_at as string) ?? new Date().toISOString(),
    distanceMeters: (h.distance_meters as number) ?? 0,
  }));

  const result = computeSafetyScore(hazards, radius);
  return NextResponse.json(result);
}
