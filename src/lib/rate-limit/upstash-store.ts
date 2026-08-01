import { ConfigurationError, DependencyUnavailableError } from '../api-errors';
import type { RateLimitCounter, RateLimitPolicy, RateLimitStore } from './types';

type FetchImplementation = typeof fetch;

const INCREMENT_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  'return {count, ttl}',
].join('\n');

export interface UpstashRateLimitOptions {
  url: string;
  token: string;
  fetchImpl?: FetchImplementation;
  namespace?: string;
}

export class UpstashRateLimitStore implements RateLimitStore {
  readonly name = 'upstash';
  private readonly url: string;
  private readonly token: string;
  private readonly fetchImpl: FetchImplementation;
  private readonly namespace: string;

  constructor(options: UpstashRateLimitOptions) {
    const token = options.token.trim();
    if (!token) throw new ConfigurationError('RATE_LIMIT_TOKEN is required for Upstash rate limiting.');
    let parsed: URL;
    try {
      parsed = new URL(options.url.trim());
    } catch {
      throw new ConfigurationError('RATE_LIMIT_URL must be a valid HTTPS URL.');
    }
    if (parsed.protocol !== 'https:') throw new ConfigurationError('RATE_LIMIT_URL must use HTTPS.');
    this.url = parsed.toString().replace(/\/$/, '');
    this.token = token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.namespace = options.namespace ?? 'pcs:rate-limit';
  }

  async increment(key: string, policy: RateLimitPolicy, now: number): Promise<RateLimitCounter> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(['EVAL', INCREMENT_SCRIPT, '1', `${this.namespace}:${key}`, String(policy.windowMs)]),
      });
    } catch {
      throw new DependencyUnavailableError('The shared rate-limit service is unavailable.');
    }
    if (!response.ok) throw new DependencyUnavailableError('The shared rate-limit service rejected the request.');

    const payload = (await response.json()) as { result?: unknown };
    const result = payload.result;
    if (!Array.isArray(result) || result.length !== 2) {
      throw new DependencyUnavailableError('The shared rate-limit service returned an invalid response.');
    }
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttl) || ttl < 0) {
      throw new DependencyUnavailableError('The shared rate-limit service returned an invalid counter.');
    }
    return { count, resetAt: now + ttl };
  }
}
