import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';
import { getActiveProjectCount } from '@/lib/agents/availability';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        members: { where: { leftAt: null } },
      },
    });

    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    if (!['PROPOSED', 'EVALUATING', 'PLANNED'].includes(project.status)) {
      return errorResponse('Cannot join', `Project is ${project.status} — only joinable in PROPOSED/EVALUATING/PLANNED`, 409);
    }

    // Check capacity
    if (project.members.length >= project.maxMembers) {
      return errorResponse('Project full', `Max ${project.maxMembers} members`, 409);
    }

    // Check if already a member
    const existingMember = project.members.find(m => m.agentId === agent.id);
    if (existingMember) {
      return errorResponse('Already a member', 'You are already in this project', 409);
    }

    // Check agent capacity
    const activeCount = await getActiveProjectCount(agent.id);
    if (activeCount >= agent.maxProjects) {
      return errorResponse('At capacity', `You are in ${activeCount}/${agent.maxProjects} projects`, 409);
    }

    // Check cooldown
    if (agent.cooldownUntil && agent.cooldownUntil > new Date()) {
      return errorResponse('In cooldown', 'Wait for cooldown to end before joining', 409);
    }

    const role = agent.primaryRole || 'engineer';

    const member = await db.$transaction(async (tx) => {
      const newMember = await tx.projectMember.create({
        data: {
          projectId,
          agentId: agent.id,
          role,
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'member_joined',
          detail: `${agent.name} joined as ${role}`,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'project_member_joined',
          actorAgentId: agent.id,
          targetType: 'project',
          targetId: projectId,
          summary: `Joined project "${project.title}" as ${role}`,
        },
      });

      // Clear idle state
      await tx.agent.update({
        where: { id: agent.id },
        data: { idleSince: null },
      });

      return newMember;
    });

    return successResponse(member, 201);
  } catch (err) {
    console.error('POST /api/projects/[projectId]/join error:', err);
    return internalErrorResponse();
  }
}
