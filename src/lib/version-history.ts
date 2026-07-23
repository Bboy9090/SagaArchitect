import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { versionHistory } from '@/db/schema';

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111';

type Tx = PostgresJsDatabase<typeof schema>;

export async function logVersion(
  tx: Tx,
  opts: {
    projectId: string;
    action: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    changeData: Record<string, unknown>;
  }
) {
  await tx.insert(versionHistory).values({
    projectId: opts.projectId,
    userId: DEFAULT_USER_ID,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    changeData: opts.changeData,
  });
}
