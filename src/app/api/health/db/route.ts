import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!db) {
    return NextResponse.json({
      ok: false,
      status: 'unavailable',
      message: 'Database connection is not configured. DATABASE_URL is missing.',
      timestamp,
    }, { status: 503 });
  }

  try {
    // Execute a simple query to verify database connection
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      ok: true,
      status: 'connected',
      message: 'Database connection verified successfully.',
      timestamp,
    });
  } catch (error: any) {
    console.error('Database connection check failed:', error);
    return NextResponse.json({
      ok: false,
      status: 'error',
      message: 'Failed to communicate with the database.',
      error: error.message || 'Unknown database error',
      timestamp,
    }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
