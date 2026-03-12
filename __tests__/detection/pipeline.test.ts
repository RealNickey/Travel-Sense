import { DetectionPipeline } from '@/lib/detection/pipeline';
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

describe('DetectionPipeline', () => {
  it('returns null for first sample (needs at least 2)', () => {
    const pipeline = new DetectionPipeline();
    const result = pipeline.processSample(makeSample());
    expect(result).toBeNull();
  });

  it('returns null for normal driving', () => {
    const pipeline = new DetectionPipeline();
    pipeline.processSample(makeSample({ timestamp: 1000 }));
    const result = pipeline.processSample(makeSample({ timestamp: 1100 }));
    expect(result).toBeNull();
  });

  it('detects pothole with spike sensor data', () => {
    const pipeline = new DetectionPipeline();
    const baseTime = Date.now();

    pipeline.processSample(makeSample({ az: 9.8, speed: 5, timestamp: baseTime }));
    const result = pipeline.processSample(
      makeSample({ az: 22, ax: 5, ay: 5, speed: 5, timestamp: baseTime + 100 })
    );
    expect(result?.hazardType).toBe('pothole');
  });

  it('resets the pipeline state', () => {
    const pipeline = new DetectionPipeline();
    pipeline.processSample(makeSample({ az: 9.8, speed: 5 }));
    pipeline.processSample(makeSample({ az: 22, ax: 5, ay: 5, speed: 5 }));
    pipeline.reset();

    // After reset, need 2 samples again
    const result = pipeline.processSample(makeSample());
    expect(result).toBeNull();
  });

  it('debounces duplicate detections', () => {
    const pipeline = new DetectionPipeline();
    const baseTime = Date.now();

    pipeline.processSample(makeSample({ az: 9.8, speed: 5, timestamp: baseTime }));
    const first = pipeline.processSample(
      makeSample({ az: 22, ax: 5, ay: 5, speed: 5, timestamp: baseTime + 100 })
    );
    expect(first?.hazardType).toBe('pothole');

    // Immediately same location should be suppressed
    const second = pipeline.processSample(
      makeSample({ az: 22, ax: 5, ay: 5, speed: 5, timestamp: baseTime + 200 })
    );
    expect(second).toBeNull();
  });
});
