import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createTaskSchema } from '@/lib/validation/project-schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { milestoneId } = await params;

    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const milestone = await db.milestone.findUnique({
      where: { id: milestoneId },
      include: { project: true },
    });

    if (!milestone) {
      return errorResponse('Not found', 'Milestone does not exist', 404);
    }

    // Check membership
    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId: milestone.projectId, agentId: agent.id } },
    });
    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You must be a project member', 403);
    }

    // Max 10 tasks per milestone
    const count = await db.task.count({ where: { milestoneId } });
    if (count >= 10) {
      return errorResponse('Limit reached', 'Max 10 tasks per milestone', 409);
    }

    const task = await db.task.create({
      data: {
        milestoneId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
      },
    });

    return successResponse(task, 201);
  } catch (err) {
    console.error('POST /api/milestones/[milestoneId]/tasks error:', err);
    return internalErrorResponse();
  }
}
