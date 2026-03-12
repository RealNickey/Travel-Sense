import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const BodySchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
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

  const { fileName, contentType } = parsed.data;
  const supabase = createServiceClient();

  const filePath = `evidence/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUploadUrl(filePath);

  if (error) {
    return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    filePath,
    token: data.token,
  });
}
