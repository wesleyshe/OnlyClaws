import { Agent } from '@prisma/client';
import { db } from '@/lib/db';

export interface ProposalQuota {
  canPropose: boolean;
  proposalsToday: number;
  maxPerDay: number;
  reason: string;
}

export async function getProposalQuota(agentId: string): Promise<ProposalQuota> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const proposalsToday = await db.proposal.count({
    where: {
      agentId,
      createdAt: { gte: oneDayAgo },
    },
  });

  const maxPerDay = 2;

  return {
    canPropose: proposalsToday < maxPerDay,
    proposalsToday,
    maxPerDay,
    reason: proposalsToday >= maxPerDay
      ? `Rate limit: ${proposalsToday}/${maxPerDay} proposals in last 24h`
      : `${proposalsToday}/${maxPerDay} proposals used`,
  };
}

export async function updateIdleState(agent: Agent): Promise<void> {
  const activeProjectCount = await db.projectMember.count({
    where: {
      agentId: agent.id,
      leftAt: null,
      project: {
        status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] },
      },
    },
  });

  if (activeProjectCount > 0 && agent.idleSince) {
    // Clear idle state — agent is now active
    await db.agent.update({
      where: { id: agent.id },
      data: { idleSince: null },
    });
  } else if (activeProjectCount === 0 && !agent.idleSince) {
    // Set idle state — agent just became idle
    await db.agent.update({
      where: { id: agent.id },
      data: { idleSince: new Date() },
    });
  }
}
