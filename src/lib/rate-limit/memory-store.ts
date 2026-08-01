import type { RateLimitCounter, RateLimitPolicy, RateLimitStore } from './types';

interface MemoryEntry {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = 'memory';
  private readonly entries = new Map<string, MemoryEntry>();

  async increment(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitCounter> {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const created = { count: 1, resetAt: now + policy.windowMs };
      this.entries.set(key, created);
      return created;
    }

    current.count += 1;
    return { ...current };
  }

  clear(): void {
    this.entries.clear();
  }
}
