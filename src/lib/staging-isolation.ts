import { ConfigurationError } from './api-errors';

const DATABASE_SCHEMA = /^[a-z][a-z0-9_]{2,62}$/;
const RATE_LIMIT_NAMESPACE = /^[A-Za-z0-9][A-Za-z0-9:_-]{2,95}$/;

export function isSafeDatabaseSchema(value: string | undefined): boolean {
  return Boolean(value && DATABASE_SCHEMA.test(value));
}

export function isSafeRateLimitNamespace(value: string | undefined): boolean {
  return Boolean(value && RATE_LIMIT_NAMESPACE.test(value));
}

export function configuredDatabaseSchema(
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = environment.DATABASE_SCHEMA?.trim().toLowerCase();
  if (!value) return undefined;
  if (!isSafeDatabaseSchema(value)) {
    throw new ConfigurationError('DATABASE_SCHEMA must be a lowercase PostgreSQL identifier.');
  }
  return value;
}

export function configuredRateLimitNamespace(
  environment: Record<string, string | undefined> = process.env,
): string | undefined {
  const value = environment.RATE_LIMIT_NAMESPACE?.trim();
  if (!value) return undefined;
  if (!isSafeRateLimitNamespace(value)) {
    throw new ConfigurationError('RATE_LIMIT_NAMESPACE contains unsupported characters.');
  }
  return value;
}

export function assertIsolatedStagingNamespaces(
  environment: Record<string, string | undefined>,
): { databaseSchema: string; rateLimitNamespace: string } {
  const databaseSchema = configuredDatabaseSchema(environment);
  const rateLimitNamespace = configuredRateLimitNamespace(environment);
  if (!databaseSchema) throw new ConfigurationError('DATABASE_SCHEMA is required for isolated staging.');
  if (databaseSchema === 'public') {
    throw new ConfigurationError('DATABASE_SCHEMA=public is not allowed for isolated staging.');
  }
  if (!rateLimitNamespace) {
    throw new ConfigurationError('RATE_LIMIT_NAMESPACE is required for isolated staging.');
  }
  if (rateLimitNamespace === 'pcs:rate-limit' || /production/i.test(rateLimitNamespace)) {
    throw new ConfigurationError('RATE_LIMIT_NAMESPACE must be staging-specific.');
  }
  return { databaseSchema, rateLimitNamespace };
}
