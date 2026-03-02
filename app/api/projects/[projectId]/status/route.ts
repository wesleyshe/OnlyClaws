import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { transitionProjectSchema } from '@/lib/validation/project-schemas';
import { transitionProject } from '@/lib/projects/lifecycle';
import { ProjectStatus } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;
    const body = await parseJsonBody(req);
    const parsed = transitionProjectSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const targetStatus = parsed.data.targetStatus as ProjectStatus;

    const result = await transitionProject(projectId, targetStatus, agent.id);

    if (!result.success) {
      return errorResponse('Transition failed', result.reason || 'Unknown error', 409);
    }

    return successResponse({ projectId, status: targetStatus });
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('PATCH /api/projects/[projectId]/status error:', err);
    return internalErrorResponse();
  }
}
