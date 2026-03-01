import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simple DB connectivity check
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dbConnected: true,
      env: {
        APP_URL: process.env.APP_URL ? 'set' : 'unset',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? 'set' : 'unset',
        RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN ?? 'unset',
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        dbConnected: false,
      },
      { status: 503 }
    );
  }
}
