import { NextResponse } from 'next/server';
import { buildDeploymentIdentity } from '@/lib/deployment-identity';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: buildDeploymentIdentity(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const dynamic = 'force-dynamic';
