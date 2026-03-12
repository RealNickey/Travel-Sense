import { SensorSample, DerivedFeatures } from './types';

export function smoothSamples(samples: SensorSample[], windowSize = 3): SensorSample[] {
  if (samples.length < windowSize) return samples;
  return samples.map((sample, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(samples.length, start + windowSize);
    const window = samples.slice(start, end);
    const avg = (key: keyof SensorSample) =>
      window.reduce((sum, s) => sum + (s[key] as number), 0) / window.length;
    return {
      ...sample,
      ax: avg('ax'), ay: avg('ay'), az: avg('az'),
      gx: avg('gx'), gy: avg('gy'), gz: avg('gz'),
    };
  });
}

export function computeMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function extractFeatures(current: SensorSample, previous?: SensorSample): DerivedFeatures {
  const accelMagnitude = computeMagnitude(current.ax, current.ay, current.az);
  const prevMag = previous ? computeMagnitude(previous.ax, previous.ay, previous.az) : accelMagnitude;
  const dt = previous ? Math.max((current.timestamp - previous.timestamp) / 1000, 0.001) : 0.1;
  const jerk = Math.abs(accelMagnitude - prevMag) / dt;
  const verticalSpike = Math.abs(current.az - 9.8); // deviation from gravity
  const rotationMagnitude = computeMagnitude(current.gx, current.gy, current.gz);
  const speedChange = previous ? Math.abs(current.speed - previous.speed) / dt : 0;
  return { accelMagnitude, jerk, verticalSpike, rotationMagnitude, speedChange };
}
