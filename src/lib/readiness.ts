export type ReadinessState = 'ready' | 'degraded' | 'unready';

export interface DependencyCheck {
  name: string;
  required: boolean;
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

export interface ReadinessReport {
  state: ReadinessState;
  httpStatus: 200 | 503;
  checkedAt: string;
  checks: DependencyCheck[];
  failedRequired: string[];
  failedOptional: string[];
}

export function evaluateReadiness(
  checks: DependencyCheck[],
  checkedAt = new Date(),
): ReadinessReport {
  const normalized = checks
    .map(check => ({
      ...check,
      latencyMs: typeof check.latencyMs === 'number' ? Math.max(0, Math.round(check.latencyMs)) : undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const failedRequired = normalized.filter(check => check.required && !check.ok).map(check => check.name);
  const failedOptional = normalized.filter(check => !check.required && !check.ok).map(check => check.name);
  const state: ReadinessState = failedRequired.length ? 'unready' : failedOptional.length ? 'degraded' : 'ready';

  return {
    state,
    httpStatus: failedRequired.length ? 503 : 200,
    checkedAt: checkedAt.toISOString(),
    checks: normalized,
    failedRequired,
    failedOptional,
  };
}
