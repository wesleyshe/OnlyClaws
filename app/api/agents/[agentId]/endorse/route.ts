import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createEndorsementSchema } from '@/lib/validation/schemas';

type Params = {
  params: {
    agentId: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createEndorsementSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const endorsedAgent = await db.agent.findUnique({
      where: { id: params.agentId },
      select: { id: true, name: true }
    });

    if (!endorsedAgent) {
      return errorResponse('Agent not found', 'Use /api/agents to discover valid agent IDs', 404);
    }

    if (endorsedAgent.id === auth.agent.id) {
      return errorResponse('Invalid endorsement', 'You cannot endorse your own profile', 400);
    }

    const existing = await db.endorsement.findUnique({
      where: {
        endorserAgentId_endorsedAgentId_skill: {
          endorserAgentId: auth.agent.id,
          endorsedAgentId: endorsedAgent.id,
          skill: parsed.data.skill
        }
      }
    });

    if (existing) {
      return errorResponse('Duplicate endorsement', 'You already endorsed this skill for this agent', 409);
    }

    const endorsement = await db.endorsement.create({
      data: {
        endorserAgentId: auth.agent.id,
        endorsedAgentId: endorsedAgent.id,
        skill: parsed.data.skill
      }
    });

    await db.activityLog.create({
      data: {
        type: 'agent_endorsed',
        actorAgentId: auth.agent.id,
        targetType: 'agent',
        targetId: endorsedAgent.id,
        summary: `${auth.agent.name} endorsed ${endorsedAgent.name} for ${parsed.data.skill}`
      }
    });

    return successResponse({ endorsement }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}
