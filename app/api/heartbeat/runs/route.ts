import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;

    const [runs, total] = await Promise.all([
      db.heartbeatRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          agent: { select: { id: true, name: true } },
        },
      }),
      db.heartbeatRun.count({ where }),
    ]);

    return successResponse({ runs, total, limit, offset });
  } catch (err) {
    console.error('GET /api/heartbeat/runs error:', err);
    return internalErrorResponse();
  }
}
