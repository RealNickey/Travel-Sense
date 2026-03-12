'use client';

import { useScanContext } from '@/lib/contexts/ScanContext';

const STATE_LABELS: Record<string, string> = {
  idle: 'Start Scan',
  requesting: 'Requesting permissions...',
  active: 'Stop Scan',
  paused: 'Resume Scan',
  error: 'Retry Scan',
};

const STATE_COLORS: Record<string, string> = {
  idle: 'bg-blue-600 hover:bg-blue-700',
  requesting: 'bg-yellow-600 cursor-wait',
  active: 'bg-red-600 hover:bg-red-700',
  paused: 'bg-blue-600 hover:bg-blue-700',
  error: 'bg-orange-600 hover:bg-orange-700',
};

export default function ScanControls() {
  const { scanState, detections, error, queueSize, startScan, stopScan } = useScanContext();

  const isActive = scanState === 'active';
  const isRequesting = scanState === 'requesting';

  return (
    <div className="space-y-2">
      {/* Main scan button */}
      <button
        onClick={isActive ? stopScan : startScan}
        disabled={isRequesting}
        className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-colors ${STATE_COLORS[scanState]}`}
      >
        <span className="flex items-center justify-center gap-2">
          {isActive && (
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          )}
          {STATE_LABELS[scanState]}
        </span>
      </button>

      {/* Status row */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {isActive ? (
            <span className="text-green-400">● Scanning for hazards</span>
          ) : (
            <span>● Idle</span>
          )}
        </span>
        <div className="flex gap-4">
          {detections.length > 0 && (
            <span className="text-yellow-400">
              {detections.length} detection{detections.length !== 1 ? 's' : ''}
            </span>
          )}
          {queueSize > 0 && (
            <span className="text-orange-400">
              {queueSize} queued offline
            </span>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
