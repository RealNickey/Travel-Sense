export type HazardType = 'pothole' | 'sudden_brake' | 'possible_crash';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SensorSample {
  timestamp: number;
  ax: number; // acceleration x
  ay: number; // acceleration y
  az: number; // acceleration z
  gx: number; // gyro x
  gy: number; // gyro y
  gz: number; // gyro z
  lat: number;
  lng: number;
  speed: number; // m/s
  accuracy: number; // GPS accuracy in meters
}

export interface DerivedFeatures {
  accelMagnitude: number;
  jerk: number;
  verticalSpike: number;
  rotationMagnitude: number;
  speedChange: number;
}

export interface DetectionCandidate {
  hazardType: HazardType;
  confidence: number;
  severity: SeverityLevel;
  timestamp: number;
  lat: number;
  lng: number;
  speed: number;
  accuracy: number;
  features: DerivedFeatures;
  reasoning: string[];
}
