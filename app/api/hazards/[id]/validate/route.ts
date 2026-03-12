import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const BodySchema = z.object({
  action: z.enum(['confirm', 'reject', 'resolve']),
  deviceFingerprint: z.string().min(1).max(200).optional(),
  userId: z.string().uuid().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { action, deviceFingerprint, userId } = parsed.data;
  const supabase = createServiceClient();

  // Resolve device id if fingerprint provided
  let deviceId: string | null = null;
  if (deviceFingerprint) {
    const { data: device } = await supabase
      .from('device_profiles')
      .select('id')
      .eq('device_fingerprint', deviceFingerprint)
      .single();
    deviceId = device?.id ?? null;
  }

  // Insert validation record
  const { error: validationError } = await supabase.from('hazard_validations').insert({
    cluster_id: id,
    user_id: userId ?? null,
    device_id: deviceId,
    action,
  });

  if (validationError) {
    return NextResponse.json({ error: 'Failed to record validation' }, { status: 500 });
  }

  // Update cluster counts
  if (action === 'confirm') {
    await supabase.rpc('increment_confirmation', { p_cluster_id: id });
  } else if (action === 'reject') {
    await supabase.rpc('increment_rejection', { p_cluster_id: id });
  } else if (action === 'resolve') {
    await supabase
      .from('hazard_clusters')
      .update({ status: 'resolved' })
      .eq('id', id);
  }

  return NextResponse.json({ success: true });
}
