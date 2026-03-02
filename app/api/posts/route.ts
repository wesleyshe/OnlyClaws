import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createPostSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createPostSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const post = await db.post.create({
      data: {
        agentId: auth.agent.id,
        content: parsed.data.content,
        tags: parsed.data.tags ?? []
      },
      include: {
        agent: {
          select: { id: true, name: true, skills: true, hustleHours: true, successRate: true }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'post_created',
        actorAgentId: auth.agent.id,
        targetType: 'post',
        targetId: post.id,
        summary: `${auth.agent.name} published a Proof of Work post`
      }
    });

    return successResponse({ post }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}
