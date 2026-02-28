import { ProjectStatus, MilestoneStatus } from '@prisma/client';
import { db } from '@/lib/db';

interface TransitionContext {
  memberCount: number;
  evaluationCount: number;
  approveCount: number;
  rejectCount: number;
  reviseCount: number;
  milestoneCount: number;
  milestonesCompleteOrSkipped: number;
  deliverableCount: number;
  hasActiveMilestone: boolean;
}

const TRANSITION_TABLE: Record<string, ProjectStatus[]> = {
  [ProjectStatus.PROPOSED]: [ProjectStatus.EVALUATING, ProjectStatus.PLANNED, ProjectStatus.ABANDONED],
  [ProjectStatus.EVALUATING]: [ProjectStatus.PLANNED, ProjectStatus.PROPOSED, ProjectStatus.ABANDONED],
  [ProjectStatus.PLANNED]: [ProjectStatus.ACTIVE, ProjectStatus.ABANDONED],
  [ProjectStatus.ACTIVE]: [ProjectStatus.DELIVERED, ProjectStatus.ABANDONED],
  [ProjectStatus.DELIVERED]: [ProjectStatus.ARCHIVED],
  [ProjectStatus.ARCHIVED]: [],
  [ProjectStatus.ABANDONED]: [],
};

export function canTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  ctx: TransitionContext
): { allowed: boolean; reason?: string } {
  const validTargets = TRANSITION_TABLE[from];
  if (!validTargets || !validTargets.includes(to)) {
    return { allowed: false, reason: `Cannot transition from ${from} to ${to}` };
  }

  // PROPOSED → EVALUATING: needs at least 1 team member
  if (from === ProjectStatus.PROPOSED && to === ProjectStatus.EVALUATING) {
    if (ctx.memberCount < 1) {
      return { allowed: false, reason: 'Need at least 1 team member to begin evaluation' };
    }
    return { allowed: true };
  }

  // PROPOSED → PLANNED: small project shortcut (1 member, skip evaluation)
  if (from === ProjectStatus.PROPOSED && to === ProjectStatus.PLANNED) {
    if (ctx.memberCount > 1) {
      return { allowed: false, reason: 'Projects with >1 member must go through evaluation' };
    }
    return { allowed: true };
  }

  // EVALUATING → PLANNED: majority APPROVE
  if (from === ProjectStatus.EVALUATING && to === ProjectStatus.PLANNED) {
    if (ctx.evaluationCount < 1) {
      return { allowed: false, reason: 'Need at least 1 evaluation' };
    }
    if (ctx.approveCount <= ctx.evaluationCount / 2) {
      return { allowed: false, reason: 'Need majority APPROVE verdicts' };
    }
    return { allowed: true };
  }

  // EVALUATING → PROPOSED: majority REVISE (loop back for resubmission)
  if (from === ProjectStatus.EVALUATING && to === ProjectStatus.PROPOSED) {
    if (ctx.reviseCount <= ctx.evaluationCount / 2) {
      return { allowed: false, reason: 'Need majority REVISE verdicts to loop back' };
    }
    return { allowed: true };
  }

  // EVALUATING → ABANDONED: majority REJECT
  if (from === ProjectStatus.EVALUATING && to === ProjectStatus.ABANDONED) {
    if (ctx.rejectCount <= ctx.evaluationCount / 2) {
      return { allowed: false, reason: 'Need majority REJECT verdicts to abandon' };
    }
    return { allowed: true };
  }

  // PLANNED → ACTIVE: at least 1 milestone defined
  if (from === ProjectStatus.PLANNED && to === ProjectStatus.ACTIVE) {
    if (ctx.milestoneCount < 1) {
      return { allowed: false, reason: 'Need at least 1 milestone defined' };
    }
    return { allowed: true };
  }

  // ACTIVE → DELIVERED: all milestones complete/skipped + deliverable exists
  if (from === ProjectStatus.ACTIVE && to === ProjectStatus.DELIVERED) {
    if (ctx.milestoneCount < 1) {
      return { allowed: false, reason: 'No milestones defined' };
    }
    if (ctx.milestonesCompleteOrSkipped < ctx.milestoneCount) {
      return { allowed: false, reason: 'Not all milestones are completed or skipped' };
    }
    if (ctx.deliverableCount < 1) {
      return { allowed: false, reason: 'Need at least 1 deliverable' };
    }
    return { allowed: true };
  }

  // DELIVERED → ARCHIVED: always allowed
  // Any → ABANDONED (from PROPOSED/PLANNED/ACTIVE): always allowed
  return { allowed: true };
}

export async function buildTransitionContext(projectId: string): Promise<TransitionContext> {
  const [members, evaluations, milestones, deliverableCount] = await Promise.all([
    db.projectMember.count({ where: { projectId, leftAt: null } }),
    db.evaluation.findMany({ where: { projectId }, select: { verdict: true } }),
    db.milestone.findMany({ where: { projectId }, select: { status: true } }),
    db.deliverable.count({ where: { projectId } }),
  ]);

  const approveCount = evaluations.filter(e => e.verdict === 'APPROVE').length;
  const rejectCount = evaluations.filter(e => e.verdict === 'REJECT').length;
  const reviseCount = evaluations.filter(e => e.verdict === 'REVISE').length;
  const milestonesCompleteOrSkipped = milestones.filter(
    m => m.status === MilestoneStatus.COMPLETED || m.status === MilestoneStatus.SKIPPED
  ).length;
  const hasActiveMilestone = milestones.some(m => m.status === MilestoneStatus.IN_PROGRESS);

  return {
    memberCount: members,
    evaluationCount: evaluations.length,
    approveCount,
    rejectCount,
    reviseCount,
    milestoneCount: milestones.length,
    milestonesCompleteOrSkipped,
    deliverableCount,
    hasActiveMilestone,
  };
}

export async function transitionProject(
  projectId: string,
  targetStatus: ProjectStatus,
  agentId: string
): Promise<{ success: boolean; reason?: string }> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return { success: false, reason: 'Project not found' };
  }

  const ctx = await buildTransitionContext(projectId);
  const check = canTransition(project.status, targetStatus, ctx);
  if (!check.allowed) {
    return { success: false, reason: check.reason };
  }

  await db.$transaction(async (tx) => {
    const now = new Date();
    const updateData: Record<string, unknown> = { status: targetStatus };

    if (targetStatus === ProjectStatus.DELIVERED || targetStatus === ProjectStatus.ARCHIVED) {
      updateData.completedAt = now;
    }

    await tx.project.update({ where: { id: projectId }, data: updateData });

    await tx.logEntry.create({
      data: {
        projectId,
        agentId,
        action: 'status_changed',
        detail: `Status changed from ${project.status} to ${targetStatus}`,
        metadata: { from: project.status, to: targetStatus },
      },
    });

    await tx.activityLog.create({
      data: {
        type: 'project_status_changed',
        actorAgentId: agentId,
        targetType: 'project',
        targetId: projectId,
        summary: `Project "${project.title}" moved to ${targetStatus}`,
      },
    });

    // Update agent performance counters on terminal states
    if (targetStatus === ProjectStatus.DELIVERED) {
      const memberIds = await tx.projectMember.findMany({
        where: { projectId, leftAt: null },
        select: { agentId: true },
      });
      for (const member of memberIds) {
        await tx.agent.update({
          where: { id: member.agentId },
          data: { projectsDelivered: { increment: 1 } },
        });
      }
    }

    if (targetStatus === ProjectStatus.ABANDONED) {
      const memberIds = await tx.projectMember.findMany({
        where: { projectId, leftAt: null },
        select: { agentId: true },
      });
      for (const member of memberIds) {
        await tx.agent.update({
          where: { id: member.agentId },
          data: { projectsAbandoned: { increment: 1 } },
        });
      }
    }
  });

  return { success: true };
}
