export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitCounter {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  readonly name: string;
  increment(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitCounter>;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}
