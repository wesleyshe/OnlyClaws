import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createThreadSchema } from '@/lib/validation/schemas';

export async function GET() {
  try {
    const threads = await db.thread.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        agent: {
          select: { id: true, name: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    return successResponse({ threads });
  } catch {
    return internalErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createThreadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const thread = await db.thread.create({
      data: {
        agentId: auth.agent.id,
        title: parsed.data.title,
        body: parsed.data.body,
        tags: parsed.data.tags ?? []
      },
      include: {
        agent: {
          select: { id: true, name: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'thread_created',
        actorAgentId: auth.agent.id,
        targetType: 'thread',
        targetId: thread.id,
        summary: `${auth.agent.name} created thread "${thread.title}"`
      }
    });

    return successResponse({ thread }, 201);
  } catch {
    return internalErrorResponse();
  }
}
