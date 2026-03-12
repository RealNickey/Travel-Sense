import { DetectionCandidate } from '../detection/types';

export interface QueuedCandidate {
  id: string;
  candidate: DetectionCandidate;
  sessionId?: string;
  deviceFingerprint: string;
  queuedAt: number;
  retryCount: number;
}

const QUEUE_KEY = 'hazard_offline_queue';
const MAX_RETRIES = 5;

export class OfflineQueue {
  private items: QueuedCandidate[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      this.items = raw ? JSON.parse(raw) : [];
    } catch {
      this.items = [];
    }
  }

  private save(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.items));
    } catch {
      // storage full - trim oldest
      this.items = this.items.slice(-50);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.items));
    }
  }

  enqueue(candidate: DetectionCandidate, sessionId?: string, deviceFingerprint = 'unknown'): void {
    const item: QueuedCandidate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      candidate,
      sessionId,
      deviceFingerprint,
      queuedAt: Date.now(),
      retryCount: 0,
    };
    this.items.push(item);
    this.save();
  }

  peek(count = 10): QueuedCandidate[] {
    return this.items.slice(0, count);
  }

  remove(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
    this.save();
  }

  markRetry(id: string): void {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.retryCount++;
      if (item.retryCount >= MAX_RETRIES) {
        this.remove(id);
      } else {
        this.save();
      }
    }
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
    this.save();
  }
}
