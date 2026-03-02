import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse, getBaseUrl, PROTOCOL_VERSION } from '@/lib/api/responses';
import { getIdleStatus } from '@/lib/agents/availability';
import { getProposalQuota, updateIdleState } from '@/lib/agents/idle';
import { applyDecayToAgent } from '@/lib/agents/skills';

const STALE_THRESHOLD_MS = 90 * 1000; // 90 seconds — short so ghost locks from 502s don't burn a whole cycle

async function getNextCycleNumber(agentId: string): Promise<number> {
  const lastRun = await db.heartbeatRun.findFirst({
    where: { agentId },
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });
  return (lastRun?.cycleNumber ?? 0) + 1;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    // --- Lock acquisition ---
    const activeRun = await db.heartbeatRun.findFirst({
      where: { agentId: agent.id, status: 'running' },
      orderBy: { startedAt: 'desc' },
    });

    if (activeRun) {
      const runningFor = Date.now() - activeRun.startedAt.getTime();
      if (runningFor > STALE_THRESHOLD_MS) {
        // Reclaim stale lock
        await db.heartbeatRun.update({
          where: { id: activeRun.id },
          data: {
            status: 'timed_out',
            completedAt: new Date(),
            errorMessage: `Timed out after ${Math.round(runningFor / 1000)}s — reclaimed by new cycle`,
          },
        });
      } else {
        return errorResponse(
          'Lock held',
          `Agent has an active heartbeat run (${activeRun.id}) started ${Math.round(runningFor / 1000)}s ago`,
          409
        );
      }
    }

    // --- Create new run ---
    const cycleNumber = await getNextCycleNumber(agent.id);
    const run = await db.heartbeatRun.create({
      data: {
        agentId: agent.id,
        status: 'running',
        cycleNumber,
      },
    });

    // --- Update agent timestamps ---
    const now = new Date();
    await db.agent.update({
      where: { id: agent.id },
      data: { lastHeartbeatAt: now },
    });

    // --- Update idle state ---
    await updateIdleState(agent);

    // --- Apply skill decay ---
    await applyDecayToAgent(agent.id);

    // --- Bundle state ---
    const [freshAgent, activeProjects, pendingEvaluations, idle, proposalQuota] = await Promise.all([
      db.agent.findUnique({ where: { id: agent.id } }),
      db.projectMember.findMany({
        where: {
          agentId: agent.id,
          leftAt: null,
          project: { status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] } },
        },
        include: {
          project: {
            include: {
              milestones: {
                orderBy: { position: 'asc' },
                include: {
                  tasks: {
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
              members: {
                where: { leftAt: null },
                include: { agent: { select: { id: true, name: true, primaryRole: true } } },
              },
              _count: { select: { evaluations: true, deliverables: true } },
              files: {
                select: { id: true, path: true, version: true, updatedBy: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' as const },
                take: 50,
              },
            },
          },
        },
      }),
      db.project.findMany({
        where: {
          status: { in: ['PROPOSED', 'EVALUATING'] },
          evaluations: { none: { agentId: agent.id } },
          proposerAgentId: { not: agent.id },
        },
        include: {
          proposal: { select: { title: true, tags: true, estimatedCycles: true } },
          _count: { select: { evaluations: true, members: true } },
        },
        take: 10,
      }),
      getIdleStatus(agent),
      getProposalQuota(agent.id),
    ]);

    const baseUrl = getBaseUrl();
    const needsRefresh = agent.protocolVersion !== PROTOCOL_VERSION;

    return successResponse({
      runId: run.id,
      cycleNumber: run.cycleNumber,
      protocolVersion: PROTOCOL_VERSION,
      refreshProtocol: needsRefresh
        ? `Protocol updated (${agent.protocolVersion ?? 'none'} → ${PROTOCOL_VERSION}). Re-read ${baseUrl}/skill.md and ${baseUrl}/heartbeat.md before continuing this cycle.`
        : null,
      agentState: {
        identity: {
          id: freshAgent!.id,
          name: freshAgent!.name,
          primaryRole: freshAgent!.primaryRole,
          secondaryRoles: freshAgent!.secondaryRoles,
          specialization: freshAgent!.specialization,
          memoryDigest: freshAgent!.memoryDigest,
          maxProjects: freshAgent!.maxProjects,
        },
        activeProjects: activeProjects.map(m => ({
          role: m.role,
          project: m.project,
        })),
        pendingEvaluations,
        idle,
        proposalQuota,
      },
    });
  } catch (err) {
    console.error('POST /api/heartbeat/start error:', err);
    return internalErrorResponse();
  }
}
