import type { EnvironmentValidationTarget, ServerEnvironment } from './env-schema';
import { assertServerEnvironment } from './env-validator';

let runtimeEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(target: EnvironmentValidationTarget = 'runtime'): ServerEnvironment {
  if (target === 'runtime') {
    runtimeEnvironment ??= assertServerEnvironment(process.env, target);
    return runtimeEnvironment;
  }
  return assertServerEnvironment(process.env, target);
}

export function resetEnvironmentCacheForTests(): void {
  runtimeEnvironment = undefined;
}
