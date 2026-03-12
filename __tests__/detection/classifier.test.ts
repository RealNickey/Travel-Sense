import { classify } from '@/lib/detection/classifier';
import { SensorSample } from '@/lib/detection/types';

function makeSample(overrides: Partial<SensorSample> = {}): SensorSample {
  return {
    timestamp: Date.now(),
    ax: 0, ay: 0, az: 9.8,
    gx: 0, gy: 0, gz: 0,
    lat: 40.7128, lng: -74.006,
    speed: 10,
    accuracy: 5,
    ...overrides,
  };
}

describe('classify', () => {
  it('returns null for normal driving', () => {
    const curr = makeSample({ speed: 10 });
    const prev = makeSample({ speed: 10, timestamp: Date.now() - 100 });
    expect(classify(curr, prev)).toBeNull();
  });

  it('detects pothole with high vertical spike and jerk', () => {
    const prev = makeSample({ az: 9.8, timestamp: 1000 });
    // High az deviation from 9.8 = high verticalSpike, high accel change = high jerk
    const curr = makeSample({ az: 25, ax: 5, ay: 5, speed: 5, timestamp: 1100 });
    const result = classify(curr, prev);
    expect(result).not.toBeNull();
    expect(result?.hazardType).toBe('pothole');
  });

  it('detects sudden brake with high speed change', () => {
    const prev = makeSample({ speed: 20, timestamp: 1000 });
    const curr = makeSample({ speed: 14, timestamp: 2000 }); // 6 m/s change in 1s
    const result = classify(curr, prev);
    expect(result?.hazardType).toBe('sudden_brake');
  });

  it('detects possible crash with high accel + rotation + speed change', () => {
    const prev = makeSample({ speed: 20, timestamp: 1000 });
    const curr = makeSample({
      ax: 20, ay: 15, az: 5,
      gx: 2, gy: 2, gz: 1,
      speed: 8,
      timestamp: 2000,
    });
    const result = classify(curr, prev);
    expect(result?.hazardType).toBe('possible_crash');
  });

  it('does not detect pothole at very low speed', () => {
    const prev = makeSample({ az: 9.8, timestamp: 1000 });
    const curr = makeSample({ az: 25, ax: 5, ay: 5, speed: 1, timestamp: 1100 }); // speed < minSpeed
    const result = classify(curr, prev);
    // Should not be pothole; might be null or something else
    expect(result?.hazardType).not.toBe('pothole');
  });

  it('returns confidence between 0 and 1', () => {
    const prev = makeSample({ az: 9.8, timestamp: 1000 });
    const curr = makeSample({ az: 25, ax: 5, ay: 5, speed: 5, timestamp: 1100 });
    const result = classify(curr, prev);
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });
});
