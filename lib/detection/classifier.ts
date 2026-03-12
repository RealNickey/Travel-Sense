import { SensorSample, DetectionCandidate, DerivedFeatures } from './types';
import { extractFeatures } from './preprocessing';

const POTHOLE_THRESHOLDS = {
  verticalSpike: 4.0,      // m/s^2 deviation from gravity
  jerk: 30.0,              // m/s^3
  minSpeed: 2.0,           // m/s (~7 km/h)
};

const BRAKE_THRESHOLDS = {
  speedChange: 3.0,        // m/s^2 deceleration
  minSpeed: 3.0,           // m/s
};

const CRASH_THRESHOLDS = {
  accelMagnitude: 25.0,    // m/s^2
  rotationMagnitude: 3.0,  // rad/s
  speedChange: 5.0,        // m/s^2
};

export function classify(
  current: SensorSample,
  previous?: SensorSample
): DetectionCandidate | null {
  const features = extractFeatures(current, previous);
  const reasoning: string[] = [];

  // possible_crash (highest priority)
  if (
    features.accelMagnitude >= CRASH_THRESHOLDS.accelMagnitude &&
    features.rotationMagnitude >= CRASH_THRESHOLDS.rotationMagnitude &&
    features.speedChange >= CRASH_THRESHOLDS.speedChange
  ) {
    reasoning.push(`accel=${features.accelMagnitude.toFixed(2)}`);
    reasoning.push(`rotation=${features.rotationMagnitude.toFixed(2)}`);
    reasoning.push(`speedChange=${features.speedChange.toFixed(2)}`);
    const confidence = computeConfidence(features, current.accuracy, 'possible_crash');
    return {
      hazardType: 'possible_crash',
      confidence,
      severity: confidence > 0.8 ? 'critical' : 'high',
      timestamp: current.timestamp,
      lat: current.lat,
      lng: current.lng,
      speed: current.speed,
      accuracy: current.accuracy,
      features,
      reasoning,
    };
  }

  // pothole
  if (
    features.verticalSpike >= POTHOLE_THRESHOLDS.verticalSpike &&
    features.jerk >= POTHOLE_THRESHOLDS.jerk &&
    current.speed >= POTHOLE_THRESHOLDS.minSpeed
  ) {
    reasoning.push(`verticalSpike=${features.verticalSpike.toFixed(2)}`);
    reasoning.push(`jerk=${features.jerk.toFixed(2)}`);
    reasoning.push(`speed=${(current.speed * 3.6).toFixed(1)} km/h`);
    const confidence = computeConfidence(features, current.accuracy, 'pothole');
    return {
      hazardType: 'pothole',
      confidence,
      severity: features.verticalSpike >= 8 ? 'high' : features.verticalSpike >= 6 ? 'medium' : 'low',
      timestamp: current.timestamp,
      lat: current.lat,
      lng: current.lng,
      speed: current.speed,
      accuracy: current.accuracy,
      features,
      reasoning,
    };
  }

  // sudden_brake
  if (
    features.speedChange >= BRAKE_THRESHOLDS.speedChange &&
    current.speed >= BRAKE_THRESHOLDS.minSpeed
  ) {
    reasoning.push(`speedChange=${features.speedChange.toFixed(2)}`);
    reasoning.push(`speed=${(current.speed * 3.6).toFixed(1)} km/h`);
    const confidence = computeConfidence(features, current.accuracy, 'sudden_brake');
    return {
      hazardType: 'sudden_brake',
      confidence,
      severity: features.speedChange >= 8 ? 'high' : 'medium',
      timestamp: current.timestamp,
      lat: current.lat,
      lng: current.lng,
      speed: current.speed,
      accuracy: current.accuracy,
      features,
      reasoning,
    };
  }

  return null;
}

function computeConfidence(
  features: DerivedFeatures,
  gpsAccuracy: number,
  type: string
): number {
  let score = 0.5;

  // GPS accuracy factor (< 10m = best)
  const gpsFactor = gpsAccuracy < 10 ? 1.0 : gpsAccuracy < 25 ? 0.8 : gpsAccuracy < 50 ? 0.6 : 0.4;

  if (type === 'pothole') {
    const spikeScore = Math.min(features.verticalSpike / 10, 1.0);
    const jerkScore = Math.min(features.jerk / 80, 1.0);
    score = (spikeScore * 0.5 + jerkScore * 0.3 + gpsFactor * 0.2);
  } else if (type === 'sudden_brake') {
    const brakeScore = Math.min(features.speedChange / 10, 1.0);
    score = brakeScore * 0.7 + gpsFactor * 0.3;
  } else if (type === 'possible_crash') {
    const accelScore = Math.min(features.accelMagnitude / 40, 1.0);
    const rotScore = Math.min(features.rotationMagnitude / 6, 1.0);
    score = accelScore * 0.4 + rotScore * 0.3 + gpsFactor * 0.3;
  }

  return Math.min(Math.max(score, 0), 1);
}
