import { DetectionDebouncer } from '@/lib/detection/debounce';
import { DetectionCandidate } from '@/lib/detection/types';

function makeCandidate(overrides: Partial<DetectionCandidate> = {}): DetectionCandidate {
  return {
    hazardType: 'pothole',
    confidence: 0.8,
    severity: 'medium',
    timestamp: Date.now(),
    lat: 40.7128,
    lng: -74.006,
    speed: 10,
    accuracy: 5,
    features: {
      accelMagnitude: 12,
      jerk: 50,
      verticalSpike: 5,
      rotationMagnitude: 0.5,
      speedChange: 0,
    },
    reasoning: [],
    ...overrides,
  };
}

describe('DetectionDebouncer', () => {
  it('does not suppress first detection', () => {
    const debouncer = new DetectionDebouncer();
    const candidate = makeCandidate();
    expect(debouncer.shouldSuppress(candidate)).toBe(false);
  });

  it('suppresses duplicate detection within debounce window', () => {
    const debouncer = new DetectionDebouncer();
    const now = Date.now();
    const first = makeCandidate({ timestamp: now });
    debouncer.record(first);

    const second = makeCandidate({ timestamp: now + 500 }); // 500ms later, same location
    expect(debouncer.shouldSuppress(second)).toBe(true);
  });

  it('does not suppress after debounce time expires', () => {
    const debouncer = new DetectionDebouncer();
    const now = Date.now();
    const first = makeCandidate({ timestamp: now });
    debouncer.record(first);

    const second = makeCandidate({ timestamp: now + 5000 }); // 5 seconds later
    expect(debouncer.shouldSuppress(second)).toBe(false);
  });

  it('does not suppress detection far away', () => {
    const debouncer = new DetectionDebouncer();
    const now = Date.now();
    const first = makeCandidate({ timestamp: now, lat: 40.7128, lng: -74.006 });
    debouncer.record(first);

    // ~1km away
    const second = makeCandidate({ timestamp: now + 100, lat: 40.7218, lng: -74.006 });
    expect(debouncer.shouldSuppress(second)).toBe(false);
  });

  it('treats different hazard types independently', () => {
    const debouncer = new DetectionDebouncer();
    const now = Date.now();
    const pothole = makeCandidate({ hazardType: 'pothole', timestamp: now });
    debouncer.record(pothole);

    const brake = makeCandidate({ hazardType: 'sudden_brake', timestamp: now + 100 });
    expect(debouncer.shouldSuppress(brake)).toBe(false);
  });

  it('resets all detections', () => {
    const debouncer = new DetectionDebouncer();
    const now = Date.now();
    const first = makeCandidate({ timestamp: now });
    debouncer.record(first);
    debouncer.reset();

    const second = makeCandidate({ timestamp: now + 100 });
    expect(debouncer.shouldSuppress(second)).toBe(false);
  });
});
