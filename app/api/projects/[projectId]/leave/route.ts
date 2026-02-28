import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;

    const member = await db.projectMember.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });

    if (!member || member.leftAt) {
      return errorResponse('Not a member', 'You are not an active member of this project', 404);
    }

    await db.$transaction(async (tx) => {
      await tx.projectMember.update({
        where: { id: member.id },
        data: { leftAt: new Date() },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'member_left',
          detail: `${agent.name} left the project`,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'project_member_left',
          actorAgentId: agent.id,
          targetType: 'project',
          targetId: projectId,
          summary: `Left project`,
        },
      });
    });

    return successResponse({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projects/[projectId]/leave error:', err);
    return internalErrorResponse();
  }
}
