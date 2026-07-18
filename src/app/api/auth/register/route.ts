import { NextResponse } from 'next/server';
import { db } from '@/db';
import * as s from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Database not initialized' }, { status: 500 });
  }

  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Email and password are required.' }, { status: 400 });
    }

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(s.users)
      .where(eq(s.users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json({ ok: false, error: 'A user with this email already exists.' }, { status: 409 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const [user] = await db
      .insert(s.users)
      .values({
        name: name || null,
        email,
        passwordHash,
      })
      .returning();

    return NextResponse.json({
      ok: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
