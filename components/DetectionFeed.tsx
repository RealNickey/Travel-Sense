'use client';

import { useScanContext } from '@/lib/contexts/ScanContext';

const HAZARD_ICONS: Record<string, string> = {
  pothole: '🕳️',
  sudden_brake: '🛑',
  possible_crash: '💥',
};

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'text-green-400 border-green-800',
  medium: 'text-yellow-400 border-yellow-800',
  high: 'text-red-400 border-red-800',
  critical: 'text-purple-400 border-purple-800',
};

export default function DetectionFeed() {
  const { detections } = useScanContext();

  if (detections.length === 0) {
    return (
      <div className="text-xs text-gray-600 text-center py-2">
        No detections yet — start scanning to detect hazards
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      <p className="text-xs text-gray-500 mb-1">Recent Detections</p>
      {detections.slice(0, 10).map((d, i) => (
        <div
          key={`${d.timestamp}-${i}`}
          className={`flex items-center gap-2 text-xs border rounded-lg px-2 py-1.5 bg-gray-900 ${SEVERITY_CLASSES[d.severity] ?? 'text-gray-300 border-gray-700'}`}
        >
          <span>{HAZARD_ICONS[d.hazardType] ?? '⚠️'}</span>
          <span className="flex-1 font-medium capitalize">{d.hazardType.replace('_', ' ')}</span>
          <span className="uppercase text-xs font-bold">{d.severity}</span>
          <span className="text-gray-500">{Math.round(d.confidence * 100)}%</span>
          <span className="text-gray-600">
            {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}
