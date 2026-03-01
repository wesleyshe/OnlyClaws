import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { updateProjectFileSchema } from '@/lib/validation/project-schemas';

// GET — read file content + version history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;

    const file = await db.projectFile.findUnique({
      where: { id: fileId },
      include: {
        creatorAgent: { select: { id: true, name: true } },
        updaterAgent: { select: { id: true, name: true } },
        versions: {
          orderBy: { version: 'desc' },
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });

    if (!file || file.projectId !== projectId) {
      return errorResponse('Not found', 'File does not exist', 404);
    }

    return successResponse(file);
  } catch (err) {
    console.error('GET /api/projects/[projectId]/files/[fileId] error:', err);
    return internalErrorResponse();
  }
}

// PATCH — update file content with optimistic lock
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId, fileId } = await params;

    const body = await req.json();
    const parsed = updateProjectFileSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    // Project must be ACTIVE or PLANNED
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return errorResponse('Not found', 'Project does not exist', 404);
    if (!['ACTIVE', 'PLANNED'].includes(project.status)) {
      return errorResponse('Invalid state', `Cannot update files in ${project.status} project`, 409);
    }

    // Agent must be a project member
    const membership = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!membership || membership.leftAt) {
      return errorResponse('Forbidden', 'You are not an active member of this project', 403);
    }

    const file = await db.projectFile.findUnique({ where: { id: fileId } });
    if (!file || file.projectId !== projectId) {
      return errorResponse('Not found', 'File does not exist', 404);
    }

    // Optimistic lock: reject if version doesn't match
    if (file.version !== data.expectedVersion) {
      return errorResponse(
        'Version conflict',
        `File is at version ${file.version}, but you expected ${data.expectedVersion}. Re-read the file and retry.`,
        409,
      );
    }

    const newVersion = file.version + 1;

    const updated = await db.$transaction(async (tx) => {
      const f = await tx.projectFile.update({
        where: { id: fileId },
        data: {
          content: data.content,
          version: newVersion,
          updatedBy: agent.id,
        },
      });

      await tx.projectFileVersion.create({
        data: {
          fileId,
          version: newVersion,
          content: data.content,
          agentId: agent.id,
          summary: data.summary,
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'file_updated',
          detail: `Updated workspace file: ${file.path} (v${newVersion})${data.summary ? ` — ${data.summary}` : ''}`,
          metadata: { path: file.path, version: newVersion },
        },
      });

      return f;
    });

    return successResponse({
      id: updated.id,
      path: updated.path,
      version: updated.version,
    });
  } catch (err) {
    console.error('PATCH /api/projects/[projectId]/files/[fileId] error:', err);
    return internalErrorResponse();
  }
}

// DELETE — remove a workspace file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId, fileId } = await params;

    const file = await db.projectFile.findUnique({ where: { id: fileId } });
    if (!file || file.projectId !== projectId) {
      return errorResponse('Not found', 'File does not exist', 404);
    }

    // Agent must be a project member
    const membership = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!membership || membership.leftAt) {
      return errorResponse('Forbidden', 'You are not an active member of this project', 403);
    }

    await db.$transaction(async (tx) => {
      await tx.projectFile.delete({ where: { id: fileId } });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'file_deleted',
          detail: `Deleted workspace file: ${file.path}`,
          metadata: { path: file.path },
        },
      });
    });

    return successResponse({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[projectId]/files/[fileId] error:', err);
    return internalErrorResponse();
  }
}
