'use client';

import { useState } from 'react';

const HAZARD_TYPES = [
  { value: 'pothole', label: '🕳️ Pothole' },
  { value: 'sudden_brake', label: '🛑 Sudden Brake Zone' },
  { value: 'possible_crash', label: '💥 Crash Site' },
  { value: 'manual', label: '⚠️ Other Hazard' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', color: 'text-green-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-red-400' },
  { value: 'critical', label: 'Critical', color: 'text-purple-400' },
];

export default function ManualReportForm() {
  const [type, setType] = useState('manual');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });

      const res = await fetch('/api/hazards/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          severity,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          description: description.trim() || undefined,
        }),
      });

      if (res.ok) {
        setStatus('success');
        setDescription('');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Submission failed');
        setStatus('error');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Location or network error');
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Hazard type */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Hazard Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          {HAZARD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Severity</label>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSeverity(s.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${severity === s.value
                  ? `border-transparent bg-gray-700 ${s.color}`
                  : 'border-gray-700 text-gray-500 hover:text-gray-300'
                }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={2}
          maxLength={500}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {status === 'submitting' ? 'Submitting...' : 'Report Hazard at My Location'}
      </button>

      {status === 'success' && (
        <p className="text-green-400 text-xs text-center">✓ Hazard reported successfully</p>
      )}
      {status === 'error' && (
        <p className="text-red-400 text-xs text-center">{errorMsg}</p>
      )}
    </form>
  );
}
