export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';
export type StorageProvider = 'local' | 'supabase' | 's3';
export type RateLimitProvider = 'memory' | 'redis' | 'upstash';
export type EnvironmentValidationTarget = 'runtime' | 'deployment';

export interface ServerEnvironment {
  appEnvironment: AppEnvironment;
  nodeEnvironment: string;
  databaseUrl: string;
  databaseMigrationUrl?: string;
  nextAuthSecret: string;
  nextAuthUrl?: string;
  storageProvider: StorageProvider;
  storagePath?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket?: string;
  rateLimitProvider: RateLimitProvider;
  rateLimitUrl?: string;
  rateLimitToken?: string;
}

export interface EnvironmentIssue {
  key: string;
  message: string;
}

export interface EnvironmentValidationResult {
  ok: boolean;
  issues: EnvironmentIssue[];
  value?: ServerEnvironment;
}

export const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
