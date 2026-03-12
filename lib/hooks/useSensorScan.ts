'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { DetectionPipeline } from '../detection/pipeline';
import { SensorSample, DetectionCandidate } from '../detection/types';
import { OfflineQueue } from '../offline/queue';
import { flushOfflineQueue } from '../offline/uploader';

export type ScanState = 'idle' | 'requesting' | 'active' | 'paused' | 'error';

interface ScanSession {
  id?: string;
  deviceFingerprint: string;
}

export function useSensorScan() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [detections, setDetections] = useState<DetectionCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const pipelineRef = useRef(new DetectionPipeline());
  const queueRef = useRef(new OfflineQueue());
  const sessionRef = useRef<ScanSession>({ deviceFingerprint: getDeviceFingerprint() });
  const locationRef = useRef<{ lat: number; lng: number; speed: number; accuracy: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const startScan = useCallback(async () => {
    setScanState('requesting');
    setError(null);

    try {
      // Request location permission
      await new Promise<void>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(() => resolve(), reject, { timeout: 10000 });
      });

      // Start location tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          locationRef.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed ?? 0,
            accuracy: pos.coords.accuracy,
          };
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000 }
      );

      // Start scan session
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: sessionRef.current.deviceFingerprint }),
        });
        if (res.ok) {
          const data = await res.json();
          sessionRef.current.id = data.sessionId;
        }
      } catch {
        // offline - continue without session
      }

      // Request motion permission (iOS)
      if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        const perm = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (perm !== 'granted') throw new Error('Motion permission denied');
      }

      pipelineRef.current.reset();
      setScanState('active');
    } catch (err: unknown) {
      setScanState('error');
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    }
  }, []);

  const stopScan = useCallback(() => {
    setScanState('idle');
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    // End session
    if (sessionRef.current.id) {
      fetch(`/api/sessions/${sessionRef.current.id}/end`, { method: 'POST' }).catch(() => {});
    }
  }, []);

  // DeviceMotion listener
  useEffect(() => {
    if (scanState !== 'active') return;

    function handleMotion(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity;
      const rot = event.rotationRate;
      if (!acc || !locationRef.current) return;

      const sample: SensorSample = {
        timestamp: Date.now(),
        ax: acc.x ?? 0,
        ay: acc.y ?? 0,
        az: acc.z ?? 0,
        gx: rot?.alpha ?? 0,
        gy: rot?.beta ?? 0,
        gz: rot?.gamma ?? 0,
        lat: locationRef.current.lat,
        lng: locationRef.current.lng,
        speed: locationRef.current.speed,
        accuracy: locationRef.current.accuracy,
      };

      const candidate = pipelineRef.current.processSample(sample);
      if (candidate) {
        setDetections((prev) => [candidate, ...prev].slice(0, 50));
        const fp = sessionRef.current.deviceFingerprint;
        const sid = sessionRef.current.id;

        if (navigator.onLine) {
          fetch('/api/candidates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidates: [candidate],
              sessionId: sid,
              deviceFingerprint: fp,
            }),
          }).catch(() => {
            queueRef.current.enqueue(candidate, sid, fp);
            setQueueSize(queueRef.current.size());
          });
        } else {
          queueRef.current.enqueue(candidate, sid, fp);
          setQueueSize(queueRef.current.size());
        }
      }
    }

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [scanState]);

  // Online/offline handling
  useEffect(() => {
    async function handleOnline() {
      await flushOfflineQueue(queueRef.current);
      setQueueSize(queueRef.current.size());
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return { scanState, detections, error, queueSize, startScan, stopScan };
}

function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'device_fp';
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, fp);
  }
  return fp;
}
