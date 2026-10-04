import { ProviderId } from '@/types';
import { sleepCancelable } from '../providers/withRetry';

/**
 * Per-provider serialization queue:
 * - At most 1 in-flight request per provider.
 * - Enforces minimum gap between consecutive requests to the SAME provider.
 * - Independent providers execute concurrently in parallel.
 * - Supports cancellation via AbortSignal.
 */
export class ProviderQueue {
  private inFlightMap: Map<ProviderId, Promise<unknown>> = new Map();
  private lastRequestEndTime: Map<ProviderId, number> = new Map();
  private defaultGapMs: number;

  constructor(defaultGapMs = 1500) {
    this.defaultGapMs = defaultGapMs;
  }

  public setGap(gapMs: number): void {
    this.defaultGapMs = Math.max(0, gapMs);
  }

  public async enqueue<T>(
    provider: ProviderId,
    task: () => Promise<T>,
    signal?: AbortSignal,
    customGapMs?: number
  ): Promise<T> {
    const gapMs = customGapMs !== undefined ? Math.max(0, customGapMs) : this.defaultGapMs;

    // Previous promise in this provider's queue
    const previous = this.inFlightMap.get(provider) || Promise.resolve();

    let taskPromise: Promise<T>;

    const execute = async (): Promise<T> => {
      // 1. Wait for preceding request to this specific provider to finish
      await previous.catch(() => {});

      if (signal?.aborted) {
        throw new DOMException('Request was cancelled.', 'AbortError');
      }

      // 2. Enforce minimum gap since the last request to this provider concluded
      const lastEnd = this.lastRequestEndTime.get(provider) || 0;
      const elapsed = Date.now() - lastEnd;
      if (elapsed < gapMs) {
        const waitMs = gapMs - elapsed;
        await sleepCancelable(waitMs, signal);
      }

      if (signal?.aborted) {
        throw new DOMException('Request was cancelled.', 'AbortError');
      }

      // 3. Execute the task and record end time
      try {
        return await task();
      } finally {
        this.lastRequestEndTime.set(provider, Date.now());
      }
    };

    taskPromise = execute();

    // Store in-flight promise to chain subsequent requests to this provider
    this.inFlightMap.set(
      provider,
      taskPromise.then(
        () => {},
        () => {}
      )
    );

    return taskPromise;
  }
}

export const providerQueue = new ProviderQueue();
