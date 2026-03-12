import { DetectionCandidate } from './types';

const DEBOUNCE_MS = 3000; // 3 seconds per hazard type
const DEBOUNCE_DISTANCE_M = 20; // 20 meter radius

interface LastDetection {
  timestamp: number;
  lat: number;
  lng: number;
}

export class DetectionDebouncer {
  private lastDetections: Map<string, LastDetection> = new Map();

  shouldSuppress(candidate: DetectionCandidate): boolean {
    const key = candidate.hazardType;
    const last = this.lastDetections.get(key);
    if (!last) return false;

    const timeDelta = candidate.timestamp - last.timestamp;
    if (timeDelta > DEBOUNCE_MS) return false;

    const dist = haversineDistance(candidate.lat, candidate.lng, last.lat, last.lng);
    return dist < DEBOUNCE_DISTANCE_M;
  }

  record(candidate: DetectionCandidate): void {
    this.lastDetections.set(candidate.hazardType, {
      timestamp: candidate.timestamp,
      lat: candidate.lat,
      lng: candidate.lng,
    });
  }

  reset(): void {
    this.lastDetections.clear();
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
