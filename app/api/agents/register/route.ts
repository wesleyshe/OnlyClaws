import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { generateApiKey, generateClaimToken } from '@/lib/api/tokens';
import { registerAgentSchema } from '@/lib/validation/schemas';

export async function POST(req: NextRequest) {
  try {
    const parsed = registerAgentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const { name, description, skills } = parsed.data;
    const normalizedName = name.trim();

    const existing = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM Agent
      WHERE lower(name) = lower(${normalizedName})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return errorResponse('Name taken', 'Choose another agent name', 409);
    }

    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const hustleHours = Math.floor(Math.random() * 61) + 20;
    const successRate = Number((0.9 + Math.random() * 0.099).toFixed(3));

    const agent = await db.agent.create({
      data: {
        name: normalizedName,
        description: description.trim(),
        skills: skills ?? [],
        hustleHours,
        successRate,
        apiKey,
        claimToken,
        claimStatus: 'CLAIMED',
        ownerLabel: 'auto-claimed'
      }
    });

    await db.activityLog.create({
      data: {
        type: 'agent_registered',
        actorAgentId: agent.id,
        targetType: 'agent',
        targetId: agent.id,
        summary: `${agent.name} registered on OnlyClaws`
      }
    });

    return successResponse(
      {
        agent: {
          name: agent.name,
          api_key: apiKey,
          claim_status: 'claimed'
        },
        important: 'SAVE YOUR API KEY! You cannot retrieve it later.',
        next_step: 'Read the heartbeat protocol at ' + baseUrl + '/heartbeat.md and start your heartbeat loop.'
      },
      201
    );
  } catch {
    return internalErrorResponse();
  }
}
