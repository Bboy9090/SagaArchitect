import { createHash } from 'node:crypto';
import { ConfigurationError, RateLimitError } from '../api-errors';
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from './policies';
import { MemoryRateLimitStore } from './memory-store';
import type { RateLimitDecision, RateLimitPolicy, RateLimitStore } from './types';

export class RateLimiter {
  constructor(private readonly store: RateLimitStore) {}

  async consume(key: string, policy: RateLimitPolicy, now = Date.now()): Promise<RateLimitDecision> {
    const counter = await this.store.increment(key, policy, now);
    const retryAfterSeconds = Math.max(1, Math.ceil((counter.resetAt - now) / 1000));
    return {
      allowed: counter.count <= policy.limit,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - counter.count),
      resetAt: counter.resetAt,
      retryAfterSeconds,
    };
  }
}

const memoryStore = new MemoryRateLimitStore();
const memoryLimiter = new RateLimiter(memoryStore);

function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown-client';
}

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function buildRateLimitKey(request: Request, policyName: string, scope?: string): string {
  const addressHash = hashIdentifier(clientAddress(request));
  const scopeHash = scope ? hashIdentifier(scope) : 'anonymous';
  return `${policyName}:${addressHash}:${scopeHash}`;
}

export function getConfiguredRateLimiter(environment: NodeJS.ProcessEnv = process.env): RateLimiter {
  const appEnvironment = (environment.APP_ENV || environment.VERCEL_ENV || 'development').toLowerCase();
  const provider = (environment.RATE_LIMIT_PROVIDER || 'memory').toLowerCase();
  const productionLike = appEnvironment === 'production' || appEnvironment === 'staging' || appEnvironment === 'preview';

  if (provider === 'memory') {
    if (productionLike) {
      throw new ConfigurationError('A shared rate-limit backend is required in staging and production.');
    }
    return memoryLimiter;
  }

  throw new ConfigurationError(`Rate-limit provider "${provider}" is configured but its shared adapter is not integrated yet.`);
}

export async function consumeRateLimit(
  request: Request,
  policyName: RateLimitPolicyName,
  scope?: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<RateLimitDecision> {
  const policy = RATE_LIMIT_POLICIES[policyName];
  const limiter = getConfiguredRateLimiter(environment);
  const decision = await limiter.consume(buildRateLimitKey(request, policy.name, scope), policy);
  if (!decision.allowed) {
    throw new RateLimitError(decision.retryAfterSeconds);
  }
  return decision;
}

export function resetMemoryRateLimiterForTests(): void {
  memoryStore.clear();
}
