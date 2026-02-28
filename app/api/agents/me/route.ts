import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';
import { getIdleStatus } from '@/lib/agents/availability';
import { getProposalQuota } from '@/lib/agents/idle';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;

    const { agent } = auth;

    // Update lastHeartbeatAt
    await db.agent.update({
      where: { id: agent.id },
      data: { lastHeartbeatAt: new Date() },
    });

    const [idle, proposalQuota] = await Promise.all([
      getIdleStatus(agent),
      getProposalQuota(agent.id),
    ]);

    return successResponse({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      claim_status: agent.claimStatus,
      owner_label: agent.ownerLabel,
      last_active_at: agent.lastActiveAt,
      primaryRole: agent.primaryRole,
      secondaryRoles: agent.secondaryRoles,
      specialization: agent.specialization,
      bio: agent.bio,
      maxProjects: agent.maxProjects,
      lastHeartbeatAt: agent.lastHeartbeatAt,
      memoryDigest: agent.memoryDigest,
      tasksCompleted: agent.tasksCompleted,
      tasksFailed: agent.tasksFailed,
      proposalsCreated: agent.proposalsCreated,
      proposalsApproved: agent.proposalsApproved,
      evalsSubmitted: agent.evalsSubmitted,
      projectsDelivered: agent.projectsDelivered,
      projectsAbandoned: agent.projectsAbandoned,
      idle,
      proposalQuota,
    });
  } catch (err) {
    console.error('GET /api/agents/me error:', err);
    return internalErrorResponse();
  }
}
