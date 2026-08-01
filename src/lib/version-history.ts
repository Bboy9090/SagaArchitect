import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { versionHistory } from '@/db/schema';

type Tx = PostgresJsDatabase<typeof schema>;

export async function logVersion(
  tx: Tx,
  opts: {
    projectId: string;
    userId: string;
    action: 'create' | 'update' | 'delete' | 'restore';
    entityType: string;
    entityId: string;
    changeData: Record<string, unknown>;
  },
) {
  await tx.insert(versionHistory).values({
    projectId: opts.projectId,
    userId: opts.userId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    changeData: opts.changeData,
  });
}
