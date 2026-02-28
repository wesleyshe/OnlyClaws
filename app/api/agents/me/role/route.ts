import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { updateRoleSchema } from '@/lib/validation/project-schemas';

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (data.primaryRole !== undefined) updateData.primaryRole = data.primaryRole;
    if (data.secondaryRoles !== undefined) updateData.secondaryRoles = data.secondaryRoles;
    if (data.specialization !== undefined) updateData.specialization = data.specialization;
    if (data.bio !== undefined) updateData.bio = data.bio;

    const updated = await db.agent.update({
      where: { id: agent.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        primaryRole: true,
        secondaryRoles: true,
        specialization: true,
        bio: true,
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('PATCH /api/agents/me/role error:', err);
    return internalErrorResponse();
  }
}
