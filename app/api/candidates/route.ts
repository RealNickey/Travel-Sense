import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const CandidateSchema = z.object({
  hazardType: z.enum(['pothole', 'sudden_brake', 'possible_crash']),
  confidence: z.number().min(0).max(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  timestamp: z.number(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0),
  accuracy: z.number().min(0),
  features: z.object({
    accelMagnitude: z.number(),
    jerk: z.number(),
    verticalSpike: z.number(),
    rotationMagnitude: z.number(),
    speedChange: z.number(),
  }),
  reasoning: z.array(z.string()),
});

const BodySchema = z.object({
  candidates: z.array(CandidateSchema).min(1).max(50),
  sessionId: z.string().uuid().optional(),
  deviceFingerprint: z.string().min(1).max(200),
});

const CLUSTER_RADIUS_M = 30;

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

  const { candidates, sessionId, deviceFingerprint } = parsed.data;
  const supabase = createServiceClient();

  // Upsert device profile
  const { data: device } = await supabase
    .from('device_profiles')
    .upsert(
      { device_fingerprint: deviceFingerprint, last_seen_at: new Date().toISOString() },
      { onConflict: 'device_fingerprint' }
    )
    .select('id')
    .single();

  const deviceId = device?.id;
  const inserted = [];

  for (const c of candidates) {
    // Check for existing cluster within CLUSTER_RADIUS_M
    const { data: nearby } = await supabase.rpc('find_nearby_cluster', {
      p_lat: c.lat,
      p_lng: c.lng,
      p_hazard_type: c.hazardType,
      p_radius_m: CLUSTER_RADIUS_M,
    });

    let clusterId: string | undefined;

    if (nearby && nearby.length > 0) {
      clusterId = nearby[0].id;
      await supabase
        .from('hazard_clusters')
        .update({
          detection_count: nearby[0].detection_count + 1,
          confidence: Math.min(nearby[0].confidence + 0.05, 1),
          severity: mergeSeverity(nearby[0].severity, c.severity),
        })
        .eq('id', clusterId);
    } else {
      const { data: newCluster } = await supabase
        .from('hazard_clusters')
        .insert({
          hazard_type: c.hazardType,
          severity: c.severity,
          location: `POINT(${c.lng} ${c.lat})`,
          confidence: c.confidence,
          first_detected_at: new Date(c.timestamp).toISOString(),
        })
        .select('id')
        .single();
      clusterId = newCluster?.id;
    }

    const { data: candidate } = await supabase
      .from('hazard_candidates')
      .insert({
        session_id: sessionId ?? null,
        device_id: deviceId ?? null,
        hazard_type: c.hazardType,
        location: `POINT(${c.lng} ${c.lat})`,
        confidence: c.confidence,
        speed_kmh: c.speed * 3.6,
        accel_magnitude: c.features.accelMagnitude,
        jerk: c.features.jerk,
        rotation_magnitude: c.features.rotationMagnitude,
        gps_accuracy: c.accuracy,
        cluster_id: clusterId ?? null,
        detected_at: new Date(c.timestamp).toISOString(),
      })
      .select('id')
      .single();

    inserted.push({ candidateId: candidate?.id, clusterId });
  }

  return NextResponse.json({ success: true, inserted });
}

function mergeSeverity(existing: string, incoming: string): string {
  const order = ['low', 'medium', 'high', 'critical'];
  const a = order.indexOf(existing);
  const b = order.indexOf(incoming);
  return order[Math.max(a, b)];
}
