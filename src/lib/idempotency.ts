import { createHash } from 'node:crypto';
import { and, eq, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as coreSchema from '@/db/schema';
import { idempotencyKeys } from '@/db/enterprise-schema';
import { ConflictError, ValidationError } from '@/lib/api-errors';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

type Database = PostgresJsDatabase<typeof coreSchema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface IdempotentOperationResult<T> {
  status: number;
  body: T;
}

export interface IdempotencyExecutionResult<T> extends IdempotentOperationResult<T> {
  replayed: boolean;
}

export interface IdempotencyInput {
  userId: string;
  route: string;
  key: string;
  requestBody: unknown;
  ttlMs?: number;
  now?: Date;
}

export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim();
  if (!raw) return null;
  if (!KEY_PATTERN.test(raw)) {
    throw new ValidationError('Idempotency-Key must be 8–128 characters using letters, numbers, dot, underscore, colon, or hyphen.');
  }
  return raw;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function idempotencyRequestHash(requestBody: unknown): string {
  return sha256(canonicalJson(requestBody));
}

export function idempotencyRecordId(userId: string, route: string, key: string): string {
  return sha256(`${userId}\n${route}\n${key}`);
}

export async function executeIdempotentMutation<T>(
  database: Database,
  input: IdempotencyInput,
  operation: (tx: Transaction) => Promise<IdempotentOperationResult<T>>,
): Promise<IdempotencyExecutionResult<T>> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  if (!Number.isFinite(ttlMs) || ttlMs < 60_000) {
    throw new ValidationError('Idempotency TTL must be at least one minute.');
  }

  const id = idempotencyRecordId(input.userId, input.route, input.key);
  const keyHash = sha256(input.key);
  const requestHash = idempotencyRequestHash(input.requestBody);
  const expiresAt = new Date(now.getTime() + ttlMs);

  return database.transaction(async (tx) => {
    await tx.delete(idempotencyKeys).where(and(eq(idempotencyKeys.id, id), lte(idempotencyKeys.expiresAt, now)));

    const inserted = await tx
      .insert(idempotencyKeys)
      .values({
        id,
        userId: input.userId,
        route: input.route,
        keyHash,
        requestHash,
        state: 'processing',
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeys.id });

    if (inserted.length === 0) {
      const [existing] = await tx
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.id, id))
        .limit(1);

      if (!existing) throw new ConflictError('The idempotent request could not be reserved. Please retry.');
      if (existing.requestHash !== requestHash || existing.route !== input.route || existing.userId !== input.userId) {
        throw new ConflictError('This Idempotency-Key was already used for a different request.');
      }
      if (existing.state !== 'completed' || existing.responseStatus === null) {
        throw new ConflictError('An identical request is already processing.');
      }

      return {
        replayed: true,
        status: existing.responseStatus,
        body: existing.responseBody as T,
      };
    }

    try {
      const result = await operation(tx);
      await tx
        .update(idempotencyKeys)
        .set({
          state: 'completed',
          responseStatus: result.status,
          responseBody: result.body,
        })
        .where(eq(idempotencyKeys.id, id));

      return { ...result, replayed: false };
    } catch (error) {
      await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.id, id));
      throw error;
    }
  });
}
