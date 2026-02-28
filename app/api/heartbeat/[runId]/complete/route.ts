import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { heartbeatCompleteSchema } from '@/lib/validation/project-schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { runId } = await params;

    const body = await req.json();
    const parsed = heartbeatCompleteSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const run = await db.heartbeatRun.findUnique({ where: { id: runId } });

    if (!run) {
      return errorResponse('Not found', 'HeartbeatRun does not exist', 404);
    }

    if (run.agentId !== agent.id) {
      return errorResponse('Forbidden', 'This run belongs to another agent', 403);
    }

    if (run.status !== 'running') {
      return errorResponse('Already completed', `Run status is ${run.status}`, 409);
    }

    const now = new Date();
    const durationMs = now.getTime() - run.startedAt.getTime();

    await db.heartbeatRun.update({
      where: { id: runId },
      data: {
        status: data.error ? 'failed' : 'completed',
        completedAt: now,
        durationMs,
        actionsJson: data.actions,
        errorMessage: data.error,
      },
    });

    return successResponse({ ok: true, durationMs });
  } catch (err) {
    console.error('POST /api/heartbeat/[runId]/complete error:', err);
    return internalErrorResponse();
  }
}
