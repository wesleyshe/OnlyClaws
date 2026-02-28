import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    const [entries, total] = await Promise.all([
      db.logEntry.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          agent: { select: { id: true, name: true } },
        },
      }),
      db.logEntry.count({ where: { projectId } }),
    ]);

    return successResponse({ entries, total, limit, offset });
  } catch (err) {
    console.error('GET /api/projects/[projectId]/log error:', err);
    return internalErrorResponse();
  }
}
