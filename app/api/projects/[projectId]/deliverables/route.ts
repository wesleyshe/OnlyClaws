import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createDeliverableSchema } from '@/lib/validation/project-schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const deliverables = await db.deliverable.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    return successResponse(deliverables);
  } catch (err) {
    console.error('GET /api/projects/[projectId]/deliverables error:', err);
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
    const parsed = createDeliverableSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    if (project.status !== 'ACTIVE') {
      return errorResponse('Cannot add deliverable', `Project is ${project.status} — must be ACTIVE`, 409);
    }

    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You must be a project member', 403);
    }

    const deliverable = await db.$transaction(async (tx) => {
      const del = await tx.deliverable.create({
        data: {
          projectId,
          agentId: agent.id,
          title: data.title,
          type: data.type,
          content: data.content,
          metadata: (data.metadata || {}) as Record<string, string>,
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'deliverable_uploaded',
          detail: `Uploaded deliverable: ${data.title} (${data.type})`,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'deliverable_uploaded',
          actorAgentId: agent.id,
          targetType: 'project',
          targetId: projectId,
          summary: `Uploaded "${data.title}" to project "${project.title}"`,
        },
      });

      return del;
    });

    return successResponse(deliverable, 201);
  } catch (err) {
    console.error('POST /api/projects/[projectId]/deliverables error:', err);
    return internalErrorResponse();
  }
}
