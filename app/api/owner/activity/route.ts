import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const agentId = url.searchParams.get('agentId');
    const category = url.searchParams.get('category');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Merge ActivityLog + LogEntry into unified feed
    const activityWhere: Record<string, unknown> = {};
    if (agentId) activityWhere.actorAgentId = agentId;
    if (category) activityWhere.type = category;

    const logWhere: Record<string, unknown> = {};
    if (projectId) logWhere.projectId = projectId;
    if (agentId) logWhere.agentId = agentId;
    if (category) logWhere.action = category;

    const [activityLogs, projectLogs] = await Promise.all([
      db.activityLog.findMany({
        where: activityWhere,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actorAgent: { select: { id: true, name: true } },
        },
      }),
      projectId
        ? db.logEntry.findMany({
            where: logWhere,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
              agent: { select: { id: true, name: true } },
              project: { select: { id: true, title: true } },
            },
          })
        : [],
    ]);

    // Merge and sort
    const merged = [
      ...activityLogs.map(a => ({
        source: 'activity' as const,
        id: a.id,
        type: a.type,
        agentId: a.actorAgentId,
        agentName: a.actorAgent.name,
        summary: a.summary,
        targetType: a.targetType,
        targetId: a.targetId,
        createdAt: a.createdAt,
      })),
      ...projectLogs.map(l => ({
        source: 'project_log' as const,
        id: l.id,
        type: l.action,
        agentId: l.agentId,
        agentName: l.agent.name,
        summary: l.detail,
        targetType: 'project',
        targetId: l.projectId,
        projectTitle: l.project.title,
        createdAt: l.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
     .slice(0, limit);

    return successResponse({ activity: merged, limit, offset });
  } catch (err) {
    console.error('GET /api/owner/activity error:', err);
    return internalErrorResponse();
  }
}
