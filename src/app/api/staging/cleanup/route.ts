import { NextResponse } from 'next/server';
import { and, inArray, like, or } from 'drizzle-orm';
import { db } from '@/db';
import { assets, users } from '@/db/schema';
import { dataLifecycleEvents } from '@/db/enterprise-schema';
import { deleteAssetObject } from '@/lib/storage/asset-storage';
import type { StorageProviderName } from '@/lib/storage/storage-provider';
import {
  assertStagingAutomationRequest,
  isStagingTestEmail,
  StagingAutomationError,
} from '@/lib/staging-automation';

const TEST_PATTERNS = [
  'pcs-staging-%@example.test',
  'pcs-chromium-%@example.test',
  'pcs-firefox-%@example.test',
  'pcs-webkit-%@example.test',
];

export async function POST(request: Request) {
  try {
    assertStagingAutomationRequest(request);
    if (!db) return NextResponse.json({ ok: false, error: 'Database unavailable.' }, { status: 503 });

    const matches = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(...TEST_PATTERNS.map((pattern) => like(users.email, pattern))));

    const stagingUsers = matches.filter((user) => isStagingTestEmail(user.email));
    const userIds = stagingUsers.map((user) => user.id);
    const ownedAssets = userIds.length
      ? await db
          .select({
            id: assets.id,
            ownerId: assets.ownerId,
            filePath: assets.filePath,
            storageProvider: assets.storageProvider,
          })
          .from(assets)
          .where(inArray(assets.ownerId, userIds))
      : [];

    let deletedObjects = 0;
    for (const asset of ownedAssets) {
      await deleteAssetObject(
        asset.storageProvider as StorageProviderName,
        asset.filePath,
      );
      deletedObjects += 1;
    }

    let deletedUsers = 0;
    if (userIds.length) {
      await db.transaction(async (tx) => {
        for (const user of stagingUsers) {
          await tx.insert(dataLifecycleEvents).values({
            actorUserId: user.id,
            subjectUserId: user.id,
            operation: 'account_delete',
            status: 'completed',
            details: {
              automation: 'staging-cleanup',
              emailClass: user.email.split('@')[0].replace(/[a-z0-9]{8}$/i, '<run>'),
            },
          });
        }
        const removed = await tx
          .delete(users)
          .where(and(inArray(users.id, userIds)))
          .returning({ id: users.id });
        deletedUsers = removed.length;
      });
    }

    const remaining = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(...TEST_PATTERNS.map((pattern) => like(users.email, pattern))));
    const remainingTestUsers = remaining.filter((user) => isStagingTestEmail(user.email));

    return NextResponse.json({
      ok: remainingTestUsers.length === 0,
      data: {
        matchedUsers: stagingUsers.length,
        matchedAssets: ownedAssets.length,
        deletedObjects,
        deletedUsers,
        remainingUsers: remainingTestUsers.length,
      },
    }, { status: remainingTestUsers.length === 0 ? 200 : 500 });
  } catch (error) {
    if (error instanceof StagingAutomationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Staging cleanup failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
