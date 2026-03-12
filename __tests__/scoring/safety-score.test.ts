import { computeSafetyScore, HazardForScoring } from '@/lib/scoring/safety-score';

function makeHazard(overrides: Partial<HazardForScoring> = {}): HazardForScoring {
  return {
    severity: 'medium',
    confidence: 0.8,
    confirmationCount: 0,
    detectionCount: 1,
    lastUpdatedAt: new Date().toISOString(),
    distanceMeters: 100,
    ...overrides,
  };
}

describe('computeSafetyScore', () => {
  it('returns perfect score with no hazards', () => {
    const result = computeSafetyScore([]);
    expect(result.score).toBe(100);
    expect(result.riskLevel).toBe('low');
    expect(result.hazardCount).toBe(0);
    expect(result.contributing).toHaveLength(0);
  });

  it('reduces score when hazards are present', () => {
    const hazards = [makeHazard({ severity: 'high', confidence: 0.9, distanceMeters: 50 })];
    const result = computeSafetyScore(hazards);
    expect(result.score).toBeLessThan(100);
    expect(result.hazardCount).toBe(1);
  });

  it('critical hazards reduce score more than low hazards', () => {
    const critical = computeSafetyScore([makeHazard({ severity: 'critical', distanceMeters: 50 })]);
    const low = computeSafetyScore([makeHazard({ severity: 'low', distanceMeters: 50 })]);
    expect(critical.score).toBeLessThan(low.score);
  });

  it('nearby hazards reduce score more than distant ones', () => {
    const nearby = computeSafetyScore([makeHazard({ distanceMeters: 10 })]);
    const far = computeSafetyScore([makeHazard({ distanceMeters: 450 })]);
    expect(nearby.score).toBeLessThan(far.score);
  });

  it('old hazards have less impact than recent ones', () => {
    const recent = computeSafetyScore([makeHazard({ lastUpdatedAt: new Date().toISOString() })]);
    const old = computeSafetyScore([
      makeHazard({ lastUpdatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString() }),
    ]);
    expect(recent.score).toBeLessThanOrEqual(old.score);
  });

  it('confirmed hazards weigh more', () => {
    const confirmed = computeSafetyScore([makeHazard({ confirmationCount: 5 })]);
    const unconfirmed = computeSafetyScore([makeHazard({ confirmationCount: 0 })]);
    expect(confirmed.score).toBeLessThanOrEqual(unconfirmed.score);
  });

  it('score is between 0 and 100', () => {
    const manyHazards = Array(20).fill(null).map(() =>
      makeHazard({ severity: 'critical', confidence: 1, distanceMeters: 5, confirmationCount: 10 })
    );
    const result = computeSafetyScore(manyHazards);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('assigns correct riskLevel based on score', () => {
    const noHazards = computeSafetyScore([]);
    expect(noHazards.riskLevel).toBe('low');

    const someHazards = computeSafetyScore([makeHazard({ severity: 'high', distanceMeters: 50 })]);
    expect(['low', 'medium', 'high', 'critical']).toContain(someHazards.riskLevel);
  });

  it('includes contributing weights in output', () => {
    const hazards = [makeHazard(), makeHazard({ severity: 'high' })];
    const result = computeSafetyScore(hazards);
    expect(result.contributing).toHaveLength(2);
    expect(result.contributing[0].weight).toBeGreaterThan(0);
  });
});
