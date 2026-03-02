import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { MilestoneStatus, ProjectStatus } from '@prisma/client';
import { transitionProject, buildTransitionContext, canTransition } from '@/lib/projects/lifecycle';

const VALID_TRANSITIONS: Record<string, string[]> = {
  [MilestoneStatus.PENDING]: [MilestoneStatus.IN_PROGRESS, MilestoneStatus.SKIPPED],
  [MilestoneStatus.IN_PROGRESS]: [MilestoneStatus.COMPLETED, MilestoneStatus.SKIPPED],
  [MilestoneStatus.COMPLETED]: [],
  [MilestoneStatus.SKIPPED]: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { milestoneId } = await params;

    const body = await parseJsonBody(req) as Record<string, unknown>;
    const targetStatus = body.status as MilestoneStatus;
    if (!targetStatus || !Object.values(MilestoneStatus).includes(targetStatus)) {
      return errorResponse('Invalid status', 'Valid statuses: PENDING, IN_PROGRESS, COMPLETED, SKIPPED', 400);
    }

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) {
      return errorResponse('Not found', 'Milestone does not exist', 404);
    }

    const validTargets = VALID_TRANSITIONS[milestone.status];
    if (!validTargets?.includes(targetStatus)) {
      return errorResponse('Invalid transition', `Cannot go from ${milestone.status} to ${targetStatus}`, 409);
    }

    // Check membership
    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId: milestone.projectId, agentId: agent.id } },
    });
    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You must be a project member', 403);
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Record<string, unknown> = { status: targetStatus };
      if (targetStatus === MilestoneStatus.COMPLETED) {
        data.completedAt = new Date();
      }

      const ms = await tx.milestone.update({
        where: { id: milestoneId },
        data,
      });

      await tx.logEntry.create({
        data: {
          projectId: milestone.projectId,
          agentId: agent.id,
          action: 'milestone_updated',
          detail: `Milestone "${milestone.title}" → ${targetStatus}`,
        },
      });

      // First IN_PROGRESS milestone triggers PLANNED → ACTIVE
      if (targetStatus === MilestoneStatus.IN_PROGRESS && milestone.project.status === ProjectStatus.PLANNED) {
        await tx.project.update({
          where: { id: milestone.projectId },
          data: { status: ProjectStatus.ACTIVE },
        });
        await tx.logEntry.create({
          data: {
            projectId: milestone.projectId,
            agentId: agent.id,
            action: 'status_changed',
            detail: 'Status changed from PLANNED to ACTIVE (milestone started)',
            metadata: { from: 'PLANNED', to: 'ACTIVE', trigger: 'milestone_started' },
          },
        });
      }

      return ms;
    });

    // Check if all milestones are done (for auto-transition to DELIVERED)
    if (targetStatus === MilestoneStatus.COMPLETED || targetStatus === MilestoneStatus.SKIPPED) {
      const project = await db.project.findUnique({ where: { id: milestone.projectId } });
      if (project?.status === ProjectStatus.ACTIVE) {
        const ctx = await buildTransitionContext(milestone.projectId);
        if (canTransition(ProjectStatus.ACTIVE, ProjectStatus.DELIVERED, ctx).allowed) {
          await transitionProject(milestone.projectId, ProjectStatus.DELIVERED, agent.id);
        }
      }
    }

    return successResponse(updated);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('PATCH /api/milestones/[milestoneId] error:', err);
    return internalErrorResponse();
  }
}
