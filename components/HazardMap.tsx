'use client';

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const HAZARD_ICONS: Record<string, string> = {
  pothole: '🕳️',
  sudden_brake: '🛑',
  possible_crash: '💥',
  manual: '⚠️',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed',
};

interface Hazard {
  id: string;
  hazard_type: string;
  severity: string;
  lat?: number;
  lng?: number;
  location?: string;
  detection_count: number;
  confidence: number;
}

export default function HazardMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 40.7128, lng: -74.006 },
        zoom: 14,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1d2330' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#304a7d' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#255763' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#0e1626' }],
          },
        ],
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });

      googleMapRef.current = map;

      // Try to center on user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      }

      // Load initial hazards
      loadHazards(map);
    }).catch(console.error);
  }, []);

  async function loadHazards(map: google.maps.Map) {
    try {
      const center = map.getCenter();
      if (!center) return;

      const res = await fetch(
        `/api/hazards?lat=${center.lat()}&lng=${center.lng()}&radius=2000`
      );
      if (!res.ok) return;

      const { hazards } = await res.json() as { hazards: Hazard[] };

      // Clear existing markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      for (const hazard of hazards) {
        // Parse location from WKT or lat/lng
        let lat: number | undefined;
        let lng: number | undefined;

        if (hazard.lat !== undefined && hazard.lng !== undefined) {
          lat = hazard.lat;
          lng = hazard.lng;
        } else if (hazard.location) {
          const match = /POINT\(([^ ]+) ([^ )]+)\)/.exec(hazard.location);
          if (match) {
            lng = parseFloat(match[1]);
            lat = parseFloat(match[2]);
          }
        }

        if (lat === undefined || lng === undefined) continue;

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          title: `${hazard.hazard_type} (${hazard.severity})`,
          label: {
            text: HAZARD_ICONS[hazard.hazard_type] ?? '⚠️',
            fontSize: '18px',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12 + Math.min(hazard.detection_count * 2, 10),
            fillColor: SEVERITY_COLORS[hazard.severity] ?? '#f59e0b',
            fillOpacity: 0.8,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="color:#111;padding:8px;min-width:160px">
              <strong>${hazard.hazard_type.replace('_', ' ')}</strong><br/>
              Severity: <span style="color:${SEVERITY_COLORS[hazard.severity]}">${hazard.severity}</span><br/>
              Detections: ${hazard.detection_count}<br/>
              Confidence: ${Math.round(hazard.confidence * 100)}%
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
      }
    } catch {
      // ignore map load errors in dev without API key
    }
  }

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
          <div className="text-center text-gray-400 p-6">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="text-sm">Google Maps API key not configured</p>
            <p className="text-xs mt-1 text-gray-500">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
          </div>
        </div>
      )}
    </div>
  );
}
