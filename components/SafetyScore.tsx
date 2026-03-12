'use client';

import { useState, useEffect } from 'react';

interface SafetyScoreData {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  hazardCount: number;
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
  critical: 'text-purple-400',
};

const RISK_BG: Record<string, string> = {
  low: 'bg-green-900/30 border-green-700',
  medium: 'bg-yellow-900/30 border-yellow-700',
  high: 'bg-red-900/30 border-red-700',
  critical: 'bg-purple-900/30 border-purple-700',
};

export default function SafetyScore() {
  const [data, setData] = useState<SafetyScoreData | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(
          `/api/safety-score?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=500`
        );
        if (res.ok) {
          const score = await res.json();
          setData(score);
        }
      } catch {
        // ignore
      }
    });

    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const res = await fetch(
            `/api/safety-score?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}&radius=500`
          );
          if (res.ok) setData(await res.json());
        } catch {
          // ignore
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${RISK_BG[data.riskLevel]}`}>
      <span className={RISK_COLORS[data.riskLevel]}>
        {data.score}
      </span>
      <span className="text-gray-400">/100</span>
      <span className={`capitalize ${RISK_COLORS[data.riskLevel]}`}>
        {data.riskLevel}
      </span>
    </div>
  );
}
