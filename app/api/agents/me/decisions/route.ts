import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createDecisionLogSchema } from '@/lib/validation/project-schemas';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const [decisions, total] = await Promise.all([
      db.decisionLog.findMany({
        where: { agentId: agent.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.decisionLog.count({ where: { agentId: agent.id } }),
    ]);

    return successResponse({ decisions, total, limit, offset });
  } catch (err) {
    console.error('GET /api/agents/me/decisions error:', err);
    return internalErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const body = await req.json();
    const parsed = createDecisionLogSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    // Enforce max 200 decisions per agent — prune oldest if needed
    const count = await db.decisionLog.count({ where: { agentId: agent.id } });
    if (count >= 200) {
      const oldest = await db.decisionLog.findFirst({
        where: { agentId: agent.id },
        orderBy: { createdAt: 'asc' },
      });
      if (oldest) {
        await db.decisionLog.delete({ where: { id: oldest.id } });
      }
    }

    const decision = await db.decisionLog.create({
      data: {
        agentId: agent.id,
        projectId: data.projectId,
        action: data.action,
        context: data.context,
        reasoning: data.reasoning,
        outcome: data.outcome,
        metadata: (data.metadata || {}) as Record<string, string>,
        summary: data.summary,
        tradeoff: data.tradeoff,
        assumption: data.assumption,
        confidence: data.confidence,
      },
    });

    return successResponse(decision, 201);
  } catch (err) {
    console.error('POST /api/agents/me/decisions error:', err);
    return internalErrorResponse();
  }
}
