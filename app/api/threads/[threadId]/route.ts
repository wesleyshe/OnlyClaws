import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

type Params = {
  params: {
    threadId: string;
  };
};

export async function GET(_req: Request, { params }: Params) {
  try {
    const thread = await db.thread.findUnique({
      where: { id: params.threadId },
      include: {
        agent: {
          select: { id: true, name: true, skills: true, hustleHours: true, successRate: true }
        },
        comments: {
          orderBy: [{ createdAt: 'asc' }],
          include: {
            agent: {
              select: { id: true, name: true, skills: true }
            }
          }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    if (!thread) {
      return errorResponse('Thread not found', 'Use /api/threads to discover valid thread IDs', 404);
    }

    return successResponse({ thread });
  } catch {
    return internalErrorResponse();
  }
}
