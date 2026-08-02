import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as coreSchema from '@/db/schema';
import { dataLifecycleEvents } from '@/db/enterprise-schema';
import { ValidationError } from './api-errors';

export type LifecycleOperation =
  | 'project_export'
  | 'project_delete'
  | 'account_export'
  | 'account_delete';

export type LifecycleStatus = 'requested' | 'completed' | 'failed';

type Database = PostgresJsDatabase<typeof coreSchema>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface LifecycleEventInput {
  actorUserId: string;
  subjectUserId: string;
  projectId?: string;
  operation: LifecycleOperation;
  status: LifecycleStatus;
  details?: Record<string, unknown>;
}

export interface ProjectDeletionReceipt {
  operation: 'project_delete';
  projectId: string;
  projectName: string;
  requestedBy: string;
  confirmedAt: string;
  retention: 'audit-receipt-only';
}

export function requiredProjectDeletionConfirmation(projectName: string): string {
  return `DELETE ${projectName.trim()}`;
}

export function buildProjectDeletionReceipt(input: {
  projectId: string;
  projectName: string;
  userId: string;
  confirmation: unknown;
  now?: Date;
}): ProjectDeletionReceipt {
  const projectName = input.projectName.trim();
  if (!projectName) throw new ValidationError('The project name is required for deletion confirmation.');
  const expected = requiredProjectDeletionConfirmation(projectName);
  if (input.confirmation !== expected) {
    throw new ValidationError(`Project deletion requires the exact confirmation phrase: ${expected}`);
  }

  return {
    operation: 'project_delete',
    projectId: input.projectId,
    projectName,
    requestedBy: input.userId,
    confirmedAt: (input.now ?? new Date()).toISOString(),
    retention: 'audit-receipt-only',
  };
}

export async function recordLifecycleEvent(
  tx: Transaction,
  input: LifecycleEventInput,
): Promise<string> {
  const [event] = await tx
    .insert(dataLifecycleEvents)
    .values({
      actorUserId: input.actorUserId,
      subjectUserId: input.subjectUserId,
      projectId: input.projectId,
      operation: input.operation,
      status: input.status,
      details: input.details ?? {},
    })
    .returning({ id: dataLifecycleEvents.id });
  return event.id;
}
