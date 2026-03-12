import { OfflineQueue } from '@/lib/offline/queue';
import { DetectionCandidate } from '@/lib/detection/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

function makeCandidate(): DetectionCandidate {
  return {
    hazardType: 'pothole',
    confidence: 0.8,
    severity: 'medium',
    timestamp: Date.now(),
    lat: 40.7128,
    lng: -74.006,
    speed: 10,
    accuracy: 5,
    features: {
      accelMagnitude: 12,
      jerk: 50,
      verticalSpike: 5,
      rotationMagnitude: 0.5,
      speedChange: 0,
    },
    reasoning: ['test'],
  };
}

describe('OfflineQueue', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('starts empty', () => {
    const queue = new OfflineQueue();
    expect(queue.size()).toBe(0);
  });

  it('enqueues items', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate(), 'session-1', 'device-fp-1');
    expect(queue.size()).toBe(1);
  });

  it('peeks without removing', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate(), 'session-1', 'device-fp-1');
    const items = queue.peek(10);
    expect(items).toHaveLength(1);
    expect(queue.size()).toBe(1);
  });

  it('removes by id', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate(), 'session-1', 'device-fp-1');
    const items = queue.peek(1);
    queue.remove(items[0].id);
    expect(queue.size()).toBe(0);
  });

  it('marks retry and increments count', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate());
    const items = queue.peek(1);
    const id = items[0].id;
    queue.markRetry(id);
    const updated = queue.peek(1);
    expect(updated[0].retryCount).toBe(1);
  });

  it('removes item after MAX_RETRIES', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate());
    const items = queue.peek(1);
    const id = items[0].id;
    for (let i = 0; i < 5; i++) {
      queue.markRetry(id);
    }
    expect(queue.size()).toBe(0);
  });

  it('persists to localStorage and reloads', () => {
    const queue1 = new OfflineQueue();
    queue1.enqueue(makeCandidate(), 'session-1', 'fp-1');

    const queue2 = new OfflineQueue(); // loads from localStorage
    expect(queue2.size()).toBe(1);
  });

  it('clears all items', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate());
    queue.enqueue(makeCandidate());
    queue.clear();
    expect(queue.size()).toBe(0);
  });

  it('assigns unique IDs to each item', () => {
    const queue = new OfflineQueue();
    queue.enqueue(makeCandidate());
    queue.enqueue(makeCandidate());
    const items = queue.peek(2);
    expect(items[0].id).not.toBe(items[1].id);
  });
});
