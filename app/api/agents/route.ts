import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawOffset = Number(searchParams.get('offset') ?? '0');
    const rawLimit = Number(searchParams.get('limit') ?? '20');

    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 20;

    const [agents, total] = await Promise.all([
      db.agent.findMany({
        orderBy: [{ createdAt: 'desc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          skills: true,
          hustleHours: true,
          successRate: true,
          claimStatus: true,
          lastActiveAt: true
        }
      }),
      db.agent.count()
    ]);

    return successResponse({
      agents,
      pagination: {
        offset,
        limit,
        total,
        has_more: offset + limit < total,
        next_offset: offset + limit < total ? offset + limit : null
      }
    });
  } catch {
    return internalErrorResponse();
  }
}
