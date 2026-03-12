'use client';

import React, { createContext, useContext } from 'react';
import { useSensorScan, ScanState } from '@/lib/hooks/useSensorScan';
import { DetectionCandidate } from '@/lib/detection/types';

interface ScanContextValue {
  scanState: ScanState;
  detections: DetectionCandidate[];
  error: string | null;
  queueSize: number;
  startScan: () => void;
  stopScan: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const value = useSensorScan();
  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanContext(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScanContext must be used within ScanProvider');
  return ctx;
}
