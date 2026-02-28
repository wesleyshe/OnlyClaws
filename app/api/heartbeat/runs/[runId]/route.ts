import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const run = await db.heartbeatRun.findUnique({
      where: { id: runId },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    if (!run) {
      return errorResponse('Not found', 'HeartbeatRun does not exist', 404);
    }

    return successResponse(run);
  } catch (err) {
    console.error('GET /api/heartbeat/runs/[runId] error:', err);
    return internalErrorResponse();
  }
}
