import { db } from '@/db';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { apiSuccess } from '@/lib/api-response';
import { ConflictError, DependencyUnavailableError, ValidationError } from '@/lib/api-errors';
import { SMALL_AUTH_BODY } from '@/lib/http/body-limits';
import { readJsonBodyWithLimit } from '@/lib/http/read-bounded-body';
import { withApiContext } from '@/lib/with-api-context';

interface RegistrationPayload {
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

export const POST = withApiContext(async (req, context) => {
  if (!db) throw new DependencyUnavailableError('Authentication service is unavailable.');

  const payload = await readJsonBodyWithLimit<RegistrationPayload>(req, {
    policy: SMALL_AUTH_BODY,
  });

  if (typeof payload.email !== 'string' || typeof payload.password !== 'string') {
    throw new ValidationError('Email and password are required.');
  }

  const email = payload.email.trim().toLowerCase();
  const password = payload.password;
  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : null;

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ValidationError('A valid email address is required.');
  if (password.length < 8 || password.length > 128) {
    throw new ValidationError('Password must be between 8 and 128 characters.');
  }

  const [existing] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
  if (existing) throw new ConflictError('A user with this email already exists.');

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(s.users)
    .values({ name: name || null, email, passwordHash })
    .returning({ id: s.users.id, name: s.users.name, email: s.users.email });

  return apiSuccess(
    { id: user.id, name: user.name, email: user.email },
    context.requestId,
    201,
  );
});

export const dynamic = 'force-dynamic';
