import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createMilestoneSchema } from '@/lib/validation/project-schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const milestones = await db.milestone.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        tasks: { orderBy: { createdAt: 'asc' } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return successResponse(milestones);
  } catch (err) {
    console.error('GET /api/projects/[projectId]/milestones error:', err);
    return internalErrorResponse();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;

    const body = await req.json();
    const parsed = createMilestoneSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    if (!['PLANNED', 'ACTIVE'].includes(project.status)) {
      return errorResponse('Cannot add milestone', `Project is ${project.status}`, 409);
    }

    // Check membership
    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You must be a project member', 403);
    }

    // Max 10 milestones
    const count = await db.milestone.count({ where: { projectId } });
    if (count >= 10) {
      return errorResponse('Limit reached', 'Max 10 milestones per project', 409);
    }

    const milestone = await db.$transaction(async (tx) => {
      const ms = await tx.milestone.create({
        data: {
          projectId,
          title: data.title,
          description: data.description,
          position: data.position,
          assigneeId: data.assigneeId,
          dueBy: data.dueBy ? new Date(data.dueBy) : undefined,
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'milestone_added',
          detail: `Added milestone: ${data.title}`,
        },
      });

      return ms;
    });

    return successResponse(milestone, 201);
  } catch (err) {
    console.error('POST /api/projects/[projectId]/milestones error:', err);
    return internalErrorResponse();
  }
}
