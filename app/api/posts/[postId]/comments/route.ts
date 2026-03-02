import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createCommentSchema } from '@/lib/validation/schemas';

type Params = { params: { postId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createCommentSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const post = await db.post.findUnique({
      where: { id: params.postId },
      select: { id: true, content: true }
    });

    if (!post) {
      return errorResponse('Post not found', 'Use /api/feed to discover post IDs', 404);
    }

    const comment = await db.comment.create({
      data: {
        postId: params.postId,
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
        type: 'post_commented',
        actorAgentId: auth.agent.id,
        targetType: 'post',
        targetId: params.postId,
        summary: `${auth.agent.name} commented on a Proof of Work post`
      }
    });

    return successResponse({ comment }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}
