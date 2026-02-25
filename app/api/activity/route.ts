import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET() {
  try {
    const rows = await db.activityLog.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      include: {
        actorAgent: {
          select: { id: true, name: true }
        }
      }
    });

    const activity = rows.map((item) => ({
      id: item.id,
      type: item.type,
      summary: item.summary,
      createdAt: item.createdAt,
      actor: {
        id: item.actorAgent.id,
        name: item.actorAgent.name
      }
    }));

    return successResponse({ activity });
  } catch {
    return internalErrorResponse();
  }
}
