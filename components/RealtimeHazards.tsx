'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface HazardCluster {
  id: string;
  hazard_type: string;
  severity: string;
  location: string;
  confidence: number;
  detection_count: number;
  status: string;
}

interface RealtimeHazardsProps {
  onHazardUpdate?: (hazard: HazardCluster) => void;
}

export default function RealtimeHazards({ onHazardUpdate }: RealtimeHazardsProps) {
  const handleHazard = useCallback((hazard: HazardCluster) => {
    onHazardUpdate?.(hazard);
  }, [onHazardUpdate]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('hazard_clusters_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hazard_clusters',
          filter: 'status=eq.active',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            handleHazard(payload.new as HazardCluster);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleHazard]);

  // This component only manages subscriptions; rendering is handled elsewhere
  return null;
}
