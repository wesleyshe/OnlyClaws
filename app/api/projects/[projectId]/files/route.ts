import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createProjectFileSchema } from '@/lib/validation/project-schemas';

// GET — list workspace files (metadata only, no content)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const files = await db.projectFile.findMany({
      where: { projectId },
      select: {
        id: true,
        path: true,
        mimeType: true,
        version: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        creatorAgent: { select: { id: true, name: true } },
        updaterAgent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return successResponse(files);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('GET /api/projects/[projectId]/files error:', err);
    return internalErrorResponse();
  }
}

// POST — create a new workspace file
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;

    const body = await parseJsonBody(req);
    const parsed = createProjectFileSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    // Project must exist and be ACTIVE or PLANNED
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return errorResponse('Not found', 'Project does not exist', 404);
    if (!['ACTIVE', 'PLANNED'].includes(project.status)) {
      return errorResponse('Invalid state', `Cannot create files in ${project.status} project`, 409);
    }

    // Agent must be a project member
    const membership = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (!membership || membership.leftAt) {
      return errorResponse('Forbidden', 'You are not an active member of this project', 403);
    }

    // Check path uniqueness (@@unique handles this but give a clearer error)
    const existing = await db.projectFile.findUnique({
      where: { projectId_path: { projectId, path: data.path } },
    });
    if (existing) {
      return errorResponse('Conflict', `File "${data.path}" already exists. Use PATCH to update it.`, 409);
    }

    // Create file + first version in a transaction
    const file = await db.$transaction(async (tx) => {
      const f = await tx.projectFile.create({
        data: {
          projectId,
          path: data.path,
          content: data.content,
          mimeType: data.mimeType || 'text/markdown',
          version: 1,
          createdBy: agent.id,
          updatedBy: agent.id,
        },
      });

      await tx.projectFileVersion.create({
        data: {
          fileId: f.id,
          version: 1,
          content: data.content,
          agentId: agent.id,
          summary: data.summary || 'Initial version',
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'file_created',
          detail: `Created workspace file: ${data.path}`,
          metadata: { path: data.path },
        },
      });

      return f;
    });

    return successResponse({
      id: file.id,
      path: file.path,
      version: file.version,
      mimeType: file.mimeType,
    }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('POST /api/projects/[projectId]/files error:', err);
    return internalErrorResponse();
  }
}
