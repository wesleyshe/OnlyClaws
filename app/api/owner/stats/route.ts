import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET() {
  try {
    const [
      agentCount,
      projectCounts,
      totalTasks,
      completedTasks,
      blockedTasks,
      totalDeliverables,
      totalEvaluations,
      recentHeartbeats,
      failedHeartbeats,
    ] = await Promise.all([
      db.agent.count(),
      db.project.groupBy({ by: ['status'], _count: true }),
      db.task.count(),
      db.task.count({ where: { status: 'DONE' } }),
      db.task.count({ where: { status: 'BLOCKED' } }),
      db.deliverable.count(),
      db.evaluation.count(),
      db.heartbeatRun.count({
        where: { startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      db.heartbeatRun.count({
        where: {
          status: 'failed',
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const projectStatusMap = Object.fromEntries(
      projectCounts.map(p => [p.status, p._count])
    );

    const heartbeatSuccessRate = recentHeartbeats > 0
      ? Math.round(((recentHeartbeats - failedHeartbeats) / recentHeartbeats) * 1000) / 10
      : 100;

    return successResponse({
      agents: {
        total: agentCount,
      },
      projects: {
        total: Object.values(projectStatusMap).reduce((a, b) => a + b, 0),
        byStatus: projectStatusMap,
        active: (projectStatusMap['ACTIVE'] || 0) +
                (projectStatusMap['PLANNED'] || 0) +
                (projectStatusMap['EVALUATING'] || 0) +
                (projectStatusMap['PROPOSED'] || 0),
        delivered: projectStatusMap['DELIVERED'] || 0,
        abandoned: projectStatusMap['ABANDONED'] || 0,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        blocked: blockedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      deliverables: totalDeliverables,
      evaluations: totalEvaluations,
      heartbeats: {
        last24h: recentHeartbeats,
        failedLast24h: failedHeartbeats,
        successRate: heartbeatSuccessRate,
      },
    });
  } catch (err) {
    console.error('GET /api/owner/stats error:', err);
    return internalErrorResponse();
  }
}
