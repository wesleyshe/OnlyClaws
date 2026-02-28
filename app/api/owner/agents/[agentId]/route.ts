import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';
import { deriveSignals, applyDecay } from '@/lib/agents/skills';
import { getAvailability } from '@/lib/agents/availability';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: {
        skillRecords: { orderBy: { level: 'desc' } },
        decisionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        projectMembers: {
          include: {
            project: { select: { id: true, title: true, status: true, createdAt: true, completedAt: true } },
          },
          orderBy: { joinedAt: 'desc' },
        },
        heartbeatRuns: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startedAt: true,
            completedAt: true,
            status: true,
            cycleNumber: true,
            durationMs: true,
          },
        },
      },
    });

    if (!agent) {
      return errorResponse('Not found', 'Agent does not exist', 404);
    }

    const now = new Date();

    // Liveness
    let liveness: 'alive' | 'stale' | 'dormant' = 'dormant';
    if (agent.lastHeartbeatAt) {
      const minutesSince = (now.getTime() - agent.lastHeartbeatAt.getTime()) / 60_000;
      if (minutesSince <= 20) liveness = 'alive';
      else if (minutesSince <= 60) liveness = 'stale';
    }

    // Active projects
    const activeProjects = agent.projectMembers.filter(m =>
      !m.leftAt && ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'].includes(m.project.status)
    );
    const availability = getAvailability(agent, activeProjects.length);

    // Skills with decay
    const skillsWithDecay = agent.skillRecords.map(s => ({
      ...s,
      level: applyDecay(s, now).level,
    }));
    const signals = deriveSignals(skillsWithDecay);

    // Success rate
    const totalTasks = agent.tasksCompleted + agent.tasksFailed;
    const successRate = totalTasks > 0 ? Math.round((agent.tasksCompleted / totalTasks) * 100) : 0;

    // Confidence calibration
    const decisionsWithOutcome = agent.decisionLogs.filter(d => d.outcome && d.confidence);
    let calibration = 0.5;
    if (decisionsWithOutcome.length >= 5) {
      let totalError = 0;
      for (const d of decisionsWithOutcome) {
        const predicted = d.confidence!;
        const actual = d.outcome === 'success' ? 1.0 : 0.0;
        totalError += Math.abs(predicted - actual);
      }
      calibration = Math.max(0, 1 - totalError / decisionsWithOutcome.length);
    }

    // Avg heartbeat duration
    const completedRuns = agent.heartbeatRuns.filter(r => r.durationMs);
    const avgDurationMs = completedRuns.length > 0
      ? Math.round(completedRuns.reduce((sum, r) => sum + r.durationMs!, 0) / completedRuns.length)
      : 0;

    return successResponse({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      primaryRole: agent.primaryRole,
      secondaryRoles: agent.secondaryRoles,
      specialization: agent.specialization,
      bio: agent.bio,
      createdAt: agent.createdAt,
      liveness,
      availability,
      lastHeartbeatAt: agent.lastHeartbeatAt,
      stats: {
        tasksCompleted: agent.tasksCompleted,
        tasksFailed: agent.tasksFailed,
        proposalsCreated: agent.proposalsCreated,
        proposalsApproved: agent.proposalsApproved,
        evalsSubmitted: agent.evalsSubmitted,
        projectsDelivered: agent.projectsDelivered,
        projectsAbandoned: agent.projectsAbandoned,
        successRate,
        calibration: Math.round(calibration * 100) / 100,
        avgHeartbeatDurationMs: avgDurationMs,
      },
      skills: skillsWithDecay,
      signals,
      projectHistory: agent.projectMembers.map(m => ({
        project: m.project,
        role: m.role,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        active: !m.leftAt,
      })),
      recentDecisions: agent.decisionLogs.map(d => ({
        id: d.id,
        action: d.action,
        summary: d.summary,
        tradeoff: d.tradeoff,
        assumption: d.assumption,
        confidence: d.confidence,
        outcome: d.outcome,
        createdAt: d.createdAt,
      })),
      recentHeartbeats: agent.heartbeatRuns,
    });
  } catch (err) {
    console.error('GET /api/owner/agents/[agentId] error:', err);
    return internalErrorResponse();
  }
}
