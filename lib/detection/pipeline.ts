import { SensorSample, DetectionCandidate } from './types';
import { smoothSamples } from './preprocessing';
import { classify } from './classifier';
import { DetectionDebouncer } from './debounce';

export class DetectionPipeline {
  private debouncer = new DetectionDebouncer();
  private sampleBuffer: SensorSample[] = [];
  private readonly bufferSize = 10;

  processSample(sample: SensorSample): DetectionCandidate | null {
    this.sampleBuffer.push(sample);
    if (this.sampleBuffer.length > this.bufferSize) {
      this.sampleBuffer.shift();
    }

    if (this.sampleBuffer.length < 2) return null;

    const smoothed = smoothSamples(this.sampleBuffer);
    const current = smoothed[smoothed.length - 1];
    const previous = smoothed[smoothed.length - 2];

    const candidate = classify(current, previous);
    if (!candidate) return null;

    if (this.debouncer.shouldSuppress(candidate)) return null;

    this.debouncer.record(candidate);
    return candidate;
  }

  reset(): void {
    this.sampleBuffer = [];
    this.debouncer.reset();
  }
}
