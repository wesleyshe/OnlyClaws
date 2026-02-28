import { Agent } from '@prisma/client';
import { db } from '@/lib/db';

export type AvailabilityStatus = 'IDLE' | 'ACTIVE' | 'BUSY' | 'COOLDOWN';

export function getAvailability(agent: Agent, activeProjectCount: number): AvailabilityStatus {
  if (agent.cooldownUntil && agent.cooldownUntil > new Date()) return 'COOLDOWN';
  if (activeProjectCount >= agent.maxProjects) return 'BUSY';
  if (activeProjectCount > 0) return 'ACTIVE';
  return 'IDLE';
}

export interface IdleStatus {
  isIdle: boolean;
  idleMinutes: number | null;
  canPropose: boolean;
  reason: string;
}

export async function getIdleStatus(agent: Agent): Promise<IdleStatus> {
  const activeProjectCount = await db.projectMember.count({
    where: {
      agentId: agent.id,
      leftAt: null,
      project: {
        status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] },
      },
    },
  });

  // Must have heartbeated recently (agent is alive)
  if (!agent.lastHeartbeatAt || Date.now() - agent.lastHeartbeatAt.getTime() > 30 * 60 * 1000) {
    return {
      isIdle: false,
      idleMinutes: null,
      canPropose: false,
      reason: 'Agent appears dormant (no heartbeat in 30 min)',
    };
  }

  // Busy agents are not idle
  if (activeProjectCount >= agent.maxProjects) {
    return {
      isIdle: false,
      idleMinutes: null,
      canPropose: false,
      reason: `At capacity (${activeProjectCount}/${agent.maxProjects} projects)`,
    };
  }

  // In cooldown
  if (agent.cooldownUntil && agent.cooldownUntil > new Date()) {
    return {
      isIdle: false,
      idleMinutes: null,
      canPropose: false,
      reason: 'In cooldown period',
    };
  }

  // Has active projects — can still propose if under cap
  if (activeProjectCount > 0) {
    return {
      isIdle: false,
      idleMinutes: null,
      canPropose: activeProjectCount < agent.maxProjects,
      reason: `Active on ${activeProjectCount} project(s)`,
    };
  }

  // Truly idle — no active projects
  const now = new Date();

  if (!agent.idleSince) {
    // First time being idle — set the timestamp
    await db.agent.update({
      where: { id: agent.id },
      data: { idleSince: now },
    });
    return {
      isIdle: true,
      idleMinutes: 0,
      canPropose: false,
      reason: 'Just became idle, waiting for 60-min threshold',
    };
  }

  const idleMinutes = Math.round((now.getTime() - agent.idleSince.getTime()) / 60_000);

  return {
    isIdle: true,
    idleMinutes,
    canPropose: idleMinutes >= 60,
    reason: idleMinutes >= 60
      ? `Idle for ${idleMinutes} min — proposal generation eligible`
      : `Idle for ${idleMinutes} min — need 60 min before proposing`,
  };
}

export async function getActiveProjectCount(agentId: string): Promise<number> {
  return db.projectMember.count({
    where: {
      agentId,
      leftAt: null,
      project: {
        status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] },
      },
    },
  });
}
