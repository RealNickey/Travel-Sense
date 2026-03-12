import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const CLUSTER_RADIUS_M = 30;

const BodySchema = z.object({
  type: z.enum(['pothole', 'sudden_brake', 'possible_crash', 'manual']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  description: z.string().max(1000).optional(),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
  deviceFingerprint: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { type, severity, lat, lng, description, evidenceUrls, deviceFingerprint } = parsed.data;
  const supabase = createServiceClient();

  // Check for existing nearby cluster
  const { data: nearby } = await supabase.rpc('find_nearby_cluster', {
    p_lat: lat,
    p_lng: lng,
    p_hazard_type: type,
    p_radius_m: CLUSTER_RADIUS_M,
  });

  let clusterId: string | null = null;

  if (nearby && nearby.length > 0) {
    clusterId = nearby[0].id;
    await supabase
      .from('hazard_clusters')
      .update({
        detection_count: nearby[0].detection_count + 1,
        confidence: Math.min(nearby[0].confidence + 0.1, 1),
        description: description ?? undefined,
        evidence_urls: evidenceUrls ?? undefined,
      })
      .eq('id', clusterId);
  } else {
    const { data: newCluster, error } = await supabase
      .from('hazard_clusters')
      .insert({
        hazard_type: type,
        severity,
        location: `POINT(${lng} ${lat})`,
        confidence: 0.7,
        description: description ?? null,
        evidence_urls: evidenceUrls ?? [],
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create hazard report' }, { status: 500 });
    }
    clusterId = newCluster.id;
  }

  // Optionally update device last_seen
  if (deviceFingerprint) {
    await supabase
      .from('device_profiles')
      .upsert(
        { device_fingerprint: deviceFingerprint, last_seen_at: new Date().toISOString() },
        { onConflict: 'device_fingerprint' }
      );
  }

  return NextResponse.json({ success: true, clusterId }, { status: 201 });
}
