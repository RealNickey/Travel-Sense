import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const BodySchema = z.object({
  deviceFingerprint: z.string().min(1).max(200),
  userId: z.string().uuid().optional(),
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

  const { deviceFingerprint, userId } = parsed.data;
  const supabase = createServiceClient();

  // Upsert device profile
  const { data: device, error: deviceError } = await supabase
    .from('device_profiles')
    .upsert(
      { device_fingerprint: deviceFingerprint, last_seen_at: new Date().toISOString() },
      { onConflict: 'device_fingerprint' }
    )
    .select('id')
    .single();

  if (deviceError) {
    return NextResponse.json({ error: 'Device registration failed' }, { status: 500 });
  }

  // Create scan session
  const { data: session, error: sessionError } = await supabase
    .from('scan_sessions')
    .insert({
      device_id: device.id,
      user_id: userId ?? null,
      status: 'active',
    })
    .select('id')
    .single();

  if (sessionError) {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, deviceId: device.id }, { status: 201 });
}
