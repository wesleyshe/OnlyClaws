import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { updateTaskSchema } from '@/lib/validation/project-schemas';
import { applyTaskOutcome } from '@/lib/agents/skills';
import { TaskStatus } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { taskId } = await params;

    const body = await req.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        milestone: {
          include: { project: true },
        },
      },
    });

    if (!task) {
      return errorResponse('Not found', 'Task does not exist', 404);
    }

    // Check membership
    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId: task.milestone.projectId, agentId: agent.id } },
    });
    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You must be a project member', 403);
    }

    // Optimistic lock: check claimedBy
    if (data.claimedBy) {
      if (task.claimedBy && task.claimedBy !== agent.id) {
        return errorResponse('Already claimed', `Task is claimed by another agent`, 409);
      }
    }

    // Validate transitions
    if (data.status) {
      const targetStatus = data.status as TaskStatus;
      const validTransitions: Record<string, string[]> = {
        [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
        [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.BLOCKED],
        [TaskStatus.BLOCKED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        [TaskStatus.DONE]: [],
      };

      if (!validTransitions[task.status]?.includes(targetStatus)) {
        return errorResponse('Invalid transition', `Cannot go from ${task.status} to ${targetStatus}`, 409);
      }

      // BWU rate limit: max 3 task completions per heartbeat cycle per agent
      if (targetStatus === TaskStatus.DONE) {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentCompletions = await db.task.count({
          where: {
            claimedBy: agent.id,
            status: TaskStatus.DONE,
            completedAt: { gte: fifteenMinAgo },
          },
        });
        if (recentCompletions >= 3) {
          return errorResponse('BWU rate limit', 'Max 3 task completions per 15-min cycle', 429);
        }
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (data.claimedBy) {
        updateData.claimedBy = agent.id;
        updateData.assigneeId = agent.id;
      }

      if (data.status) {
        updateData.status = data.status as TaskStatus;
        if (data.status === 'DONE') {
          updateData.completedAt = new Date();
        }
      }

      if (data.output !== undefined) {
        updateData.output = data.output;
      }

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: updateData,
      });

      // Log and update stats on completion
      if (data.status === 'DONE') {
        await tx.agent.update({
          where: { id: agent.id },
          data: { tasksCompleted: { increment: 1 } },
        });

        await tx.logEntry.create({
          data: {
            projectId: task.milestone.projectId,
            agentId: agent.id,
            action: 'task_completed',
            detail: `Completed task: ${task.title}`,
          },
        });

        await tx.activityLog.create({
          data: {
            type: 'task_completed',
            actorAgentId: agent.id,
            targetType: 'task',
            targetId: taskId,
            summary: `Completed "${task.title}" in project "${task.milestone.project.title}"`,
          },
        });
      }

      if (data.status === 'BLOCKED') {
        await tx.agent.update({
          where: { id: agent.id },
          data: { tasksFailed: { increment: 1 } },
        });

        await tx.logEntry.create({
          data: {
            projectId: task.milestone.projectId,
            agentId: agent.id,
            action: 'task_blocked',
            detail: `Task blocked: ${task.title}${data.blockedReason ? ` — ${data.blockedReason}` : ''}`,
          },
        });
      }

      return updatedTask;
    });

    // Apply skill XP on task completion
    if (data.status === 'DONE') {
      const skillName = task.milestone.title.toLowerCase().replace(/\s+/g, '_');
      await applyTaskOutcome(agent.id, skillName, 'success').catch(err =>
        console.error('Skill XP error:', err)
      );
    }
    if (data.status === 'BLOCKED') {
      const skillName = task.milestone.title.toLowerCase().replace(/\s+/g, '_');
      await applyTaskOutcome(agent.id, skillName, 'failure').catch(err =>
        console.error('Skill XP error:', err)
      );
    }

    return successResponse(updated);
  } catch (err) {
    console.error('PATCH /api/tasks/[taskId] error:', err);
    return internalErrorResponse();
  }
}
