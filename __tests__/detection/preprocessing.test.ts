import { smoothSamples, computeMagnitude, extractFeatures } from '@/lib/detection/preprocessing';
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

describe('smoothSamples', () => {
  it('returns samples unchanged when fewer than windowSize', () => {
    const samples = [makeSample(), makeSample()];
    const result = smoothSamples(samples, 3);
    expect(result).toEqual(samples);
  });

  it('averages sensor values within window', () => {
    const samples = [
      makeSample({ ax: 0 }),
      makeSample({ ax: 3 }),
      makeSample({ ax: 6 }),
    ];
    const result = smoothSamples(samples, 3);
    expect(result[1].ax).toBeCloseTo(3, 1);
  });

  it('preserves non-sensor fields', () => {
    const samples = [makeSample({ lat: 10 }), makeSample({ lat: 10 }), makeSample({ lat: 10 })];
    const result = smoothSamples(samples, 3);
    expect(result[0].lat).toBe(10);
  });
});

describe('computeMagnitude', () => {
  it('computes 3D magnitude correctly', () => {
    expect(computeMagnitude(3, 4, 0)).toBeCloseTo(5);
    expect(computeMagnitude(0, 0, 0)).toBe(0);
    expect(computeMagnitude(1, 1, 1)).toBeCloseTo(Math.sqrt(3));
  });
});

describe('extractFeatures', () => {
  it('computes vertical spike as deviation from 9.8', () => {
    const sample = makeSample({ az: 20 });
    const features = extractFeatures(sample);
    expect(features.verticalSpike).toBeCloseTo(Math.abs(20 - 9.8));
  });

  it('computes speed change from previous sample', () => {
    const prev = makeSample({ speed: 10, timestamp: 1000 });
    const curr = makeSample({ speed: 20, timestamp: 2000 });
    const features = extractFeatures(curr, prev);
    expect(features.speedChange).toBeCloseTo(10); // |20-10| / 1s
  });

  it('handles missing previous sample gracefully', () => {
    const sample = makeSample();
    const features = extractFeatures(sample);
    expect(features.speedChange).toBe(0);
    expect(features.jerk).toBe(0);
  });
});
