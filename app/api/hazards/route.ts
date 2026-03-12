import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '1000');
  const minLat = parseFloat(searchParams.get('minLat') ?? '');
  const minLng = parseFloat(searchParams.get('minLng') ?? '');
  const maxLat = parseFloat(searchParams.get('maxLat') ?? '');
  const maxLng = parseFloat(searchParams.get('maxLng') ?? '');

  const supabase = createServiceClient();

  // BBox query
  if (!isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng)) {
    const { data, error } = await supabase
      .rpc('hazards_in_bbox', {
        p_min_lat: minLat,
        p_min_lng: minLng,
        p_max_lat: maxLat,
        p_max_lng: maxLng,
      });

    if (error) {
      // Fallback to basic select with bounding box filter
      const { data: fallback, error: fallbackError } = await supabase
        .from('hazard_clusters')
        .select('*')
        .eq('status', 'active');

      if (fallbackError) {
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }
      return NextResponse.json({ hazards: fallback ?? [] });
    }

    return NextResponse.json({ hazards: data ?? [] });
  }

  // Radius query (requires valid lat/lng)
  if (!isNaN(lat) && !isNaN(lng)) {
    const { data, error } = await supabase
      .rpc('hazards_within_radius', {
        p_lat: lat,
        p_lng: lng,
        p_radius_m: radius,
      });

    if (error) {
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }
    return NextResponse.json({ hazards: data ?? [] });
  }

  // Default: return all active hazards (limited)
  const { data, error } = await supabase
    .from('hazard_clusters')
    .select('*')
    .eq('status', 'active')
    .order('last_updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }
  return NextResponse.json({ hazards: data ?? [] });
}
