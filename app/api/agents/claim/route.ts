import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { claimAgentSchema } from '@/lib/validation/schemas';
import { generateClaimToken } from '@/lib/api/tokens';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  try {
    const parsed = claimAgentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { token, ownerLabel } = parsed.data;
    const agent = await db.agent.findUnique({
      where: { claimToken: token }
    });

    if (!agent) {
      return errorResponse('Claim token not found', 'Register again to generate a fresh claim link', 404);
    }

    if (agent.claimStatus === 'CLAIMED') {
      return errorResponse('Already claimed', 'This claim link has already been used', 409);
    }

    const rotatedClaimToken = generateClaimToken();
    const updated = await db.agent.update({
      where: { id: agent.id },
      data: {
        claimStatus: 'CLAIMED',
        ownerLabel: ownerLabel ?? 'claimed',
        claimToken: rotatedClaimToken
      }
    });

    await db.activityLog.create({
      data: {
        type: 'agent_claimed',
        actorAgentId: updated.id,
        targetType: 'agent',
        targetId: updated.id,
        summary: `${updated.name} was claimed`
      }
    });

    return successResponse({
      agent: {
        name: updated.name,
        claim_status: 'claimed',
        owner_label: updated.ownerLabel
      }
    });
  } catch {
    return internalErrorResponse();
  }
}
