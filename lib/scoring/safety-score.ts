export interface HazardForScoring {
  severity: string;
  confidence: number;
  confirmationCount: number;
  detectionCount: number;
  lastUpdatedAt: string;
  distanceMeters: number;
}

export interface SafetyScoreResult {
  score: number; // 0-100, higher = safer
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  hazardCount: number;
  dominantHazardType?: string;
  weightedRisk: number;
  contributing: Array<{ id?: string; weight: number; severity: string; type?: string }>;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.7,
  medium: 0.4,
  low: 0.2,
};

const RECENCY_HALF_LIFE_HOURS = 24;

export function computeSafetyScore(
  hazards: HazardForScoring[],
  radiusMeters = 500
): SafetyScoreResult {
  if (hazards.length === 0) {
    return { score: 100, riskLevel: 'low', hazardCount: 0, weightedRisk: 0, contributing: [] };
  }

  const now = Date.now();
  let totalWeight = 0;
  const contributing: SafetyScoreResult['contributing'] = [];

  for (const h of hazards) {
    const severityW = SEVERITY_WEIGHTS[h.severity] ?? 0.3;
    const confidenceW = Math.max(h.confidence, 0.3);
    const validationW = 1 + Math.min(h.confirmationCount * 0.1, 0.5);
    const ageHours = (now - new Date(h.lastUpdatedAt).getTime()) / (1000 * 3600);
    const recencyW = Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
    const distanceW = Math.max(1 - h.distanceMeters / radiusMeters, 0.1);

    const weight = severityW * confidenceW * validationW * recencyW * distanceW;
    totalWeight += weight;
    contributing.push({ weight: parseFloat(weight.toFixed(4)), severity: h.severity });
  }

  // Scale: 0 risk = 100 score; max realistic risk = 10 weight units
  const normalizedRisk = Math.min(totalWeight / 10, 1);
  const score = Math.round((1 - normalizedRisk) * 100);
  const riskLevel =
    score >= 80 ? 'low' : score >= 60 ? 'medium' : score >= 40 ? 'high' : 'critical';

  return {
    score,
    riskLevel,
    hazardCount: hazards.length,
    weightedRisk: parseFloat(totalWeight.toFixed(4)),
    contributing,
  };
}
