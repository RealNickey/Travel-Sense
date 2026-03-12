import { OfflineQueue } from './queue';

export async function flushOfflineQueue(queue: OfflineQueue): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  const items = queue.peek(20);
  for (const item of items) {
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: [item.candidate],
          sessionId: item.sessionId,
          deviceFingerprint: item.deviceFingerprint,
        }),
      });
      if (res.ok) {
        queue.remove(item.id);
      } else {
        queue.markRetry(item.id);
      }
    } catch {
      queue.markRetry(item.id);
    }
  }
}
