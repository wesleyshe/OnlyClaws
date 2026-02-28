import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { updateMemorySchema } from '@/lib/validation/project-schemas';

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const body = await req.json();
    const parsed = updateMemorySchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    await db.agent.update({
      where: { id: agent.id },
      data: { memoryDigest: parsed.data.digest },
    });

    return successResponse({ ok: true });
  } catch (err) {
    console.error('PUT /api/agents/me/memory error:', err);
    return internalErrorResponse();
  }
}
