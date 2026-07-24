import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { db } from '@/db';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function testAuthBypassEnabled(): boolean {
  return process.env.APP_ENV === 'test' && process.env.ENABLE_TEST_AUTH_BYPASS === 'true';
}

export async function requireUser(): Promise<string> {
  // This header is accepted only by explicitly configured isolated test servers.
  // It is ignored in development, preview, staging, and production.
  if (testAuthBypassEnabled()) {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { headers } = require('next/headers');
      const requestHeaders = await headers();
      const testUserId = requestHeaders.get('x-test-session-user-id')?.trim();
      if (testUserId) {
        if (!UUID_RE.test(testUserId)) throw new AuthError(401, 'Unauthorized: Invalid test session.');
        return testUserId;
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      // next/headers can fail outside a Next request context; continue to normal session auth.
    }
  }

  const session = await getServerSession(authOptions);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const userId = (session?.user as any)?.id;
  if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) {
    throw new AuthError(401, 'Unauthorized: Session missing or expired.');
  }
  return userId;
}

export async function requireOwnedProject(projectId: string, userId: string) {
  if (!db) throw new AuthError(503, 'Database service unavailable.');
  const [project] = await db
    .select()
    .from(s.projects)
    .where(eq(s.projects.id, projectId))
    .limit(1);

  if (!project) throw new AuthError(404, 'Project not found.');
  if (project.ownerId !== userId) throw new AuthError(403, 'Forbidden: You do not own this project.');
  return project;
}

export async function requireOwnedScene(sceneId: string, userId: string) {
  if (!db) throw new AuthError(503, 'Database service unavailable.');
  const [scene] = await db.select().from(s.scenes).where(eq(s.scenes.id, sceneId)).limit(1);
  if (!scene) throw new AuthError(404, 'Scene not found.');
  await requireOwnedProject(scene.projectId, userId);
  return scene;
}

export async function requireOwnedStoryboardPanel(panelId: string, userId: string) {
  if (!db) throw new AuthError(503, 'Database service unavailable.');
  const [panel] = await db
    .select()
    .from(s.storyboardPanels)
    .where(eq(s.storyboardPanels.id, panelId))
    .limit(1);
  if (!panel) throw new AuthError(404, 'Storyboard panel not found.');
  await requireOwnedScene(panel.sceneId, userId);
  return panel;
}

export async function requireOwnedAsset(assetId: string, userId: string) {
  if (!db) throw new AuthError(503, 'Database service unavailable.');
  const [asset] = await db.select().from(s.assets).where(eq(s.assets.id, assetId)).limit(1);
  if (!asset) throw new AuthError(404, 'Asset not found.');
  await requireOwnedProject(asset.projectId, userId);
  return asset;
}
