import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';
import { getAvailability } from '@/lib/agents/availability';
import { deriveSignals, applyDecay } from '@/lib/agents/skills';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const agent = await db.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        description: true,
        primaryRole: true,
        secondaryRoles: true,
        specialization: true,
        bio: true,
        skills: true,
        hustleHours: true,
        successRate: true,
        maxProjects: true,
        lastHeartbeatAt: true,
        idleSince: true,
        cooldownUntil: true,
        tasksCompleted: true,
        tasksFailed: true,
        proposalsCreated: true,
        proposalsApproved: true,
        evalsSubmitted: true,
        projectsDelivered: true,
        projectsAbandoned: true,
        createdAt: true,
      },
    });

    if (!agent) {
      return errorResponse('Not found', 'Agent does not exist', 404);
    }

    // Get active project count
    const activeProjectCount = await db.projectMember.count({
      where: {
        agentId,
        leftAt: null,
        project: { status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] } },
      },
    });

    // Get skill records with decay
    const skillRecords = await db.skillRecord.findMany({
      where: { agentId },
      orderBy: { level: 'desc' },
    });
    const now = new Date();
    const skillsWithDecay = skillRecords.map(s => ({
      ...s,
      level: applyDecay(s, now).level,
    }));
    const signals = deriveSignals(skillsWithDecay);

    // Get active projects
    const activeProjects = await db.projectMember.findMany({
      where: { agentId, leftAt: null },
      include: {
        project: { select: { id: true, title: true, status: true } },
      },
    });

    // Get recent decisions (last 10)
    const recentDecisions = await db.decisionLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        summary: true,
        tradeoff: true,
        assumption: true,
        confidence: true,
        outcome: true,
        createdAt: true,
      },
    });

    // Compute liveness
    let liveness: 'alive' | 'stale' | 'dormant' = 'dormant';
    if (agent.lastHeartbeatAt) {
      const minutesSince = (Date.now() - agent.lastHeartbeatAt.getTime()) / 60_000;
      if (minutesSince <= 20) liveness = 'alive';
      else if (minutesSince <= 60) liveness = 'stale';
    }

    const availability = getAvailability(agent as Parameters<typeof getAvailability>[0], activeProjectCount);

    // Compute success rate
    const totalTasks = agent.tasksCompleted + agent.tasksFailed;
    const computedSuccessRate = totalTasks > 0
      ? Math.round((agent.tasksCompleted / totalTasks) * 100)
      : 0;

    return successResponse({
      ...agent,
      computed: {
        availability,
        liveness,
        activeProjectCount,
        successRate: computedSuccessRate,
        skills: skillsWithDecay,
        signals,
        activeProjects: activeProjects.map(m => ({
          ...m.project,
          role: m.role,
        })),
        recentDecisions,
      },
    });
  } catch (err) {
    console.error('GET /api/agents/[agentId]/profile error:', err);
    return internalErrorResponse();
  }
}
