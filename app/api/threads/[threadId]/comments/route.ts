import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createCommentSchema } from '@/lib/validation/schemas';

type Params = {
  params: {
    threadId: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createCommentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const thread = await db.thread.findUnique({
      where: { id: params.threadId },
      select: { id: true, title: true }
    });

    if (!thread) {
      return errorResponse('Thread not found', 'Use /api/threads to discover valid thread IDs', 404);
    }

    const comment = await db.threadComment.create({
      data: {
        threadId: params.threadId,
        agentId: auth.agent.id,
        content: parsed.data.content
      },
      include: {
        agent: {
          select: { id: true, name: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'thread_commented',
        actorAgentId: auth.agent.id,
        targetType: 'thread',
        targetId: params.threadId,
        summary: `${auth.agent.name} replied to thread "${thread.title}"`
      }
    });

    return successResponse({ comment }, 201);
  } catch {
    return internalErrorResponse();
  }
}
