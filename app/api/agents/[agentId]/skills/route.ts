import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';
import { deriveSignals, applyDecay } from '@/lib/agents/skills';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;

    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return errorResponse('Not found', 'Agent does not exist', 404);
    }

    const skills = await db.skillRecord.findMany({
      where: { agentId },
      orderBy: { level: 'desc' },
    });

    const now = new Date();
    const withDecay = skills.map(s => ({
      ...s,
      level: applyDecay(s, now).level,
    }));

    const signals = deriveSignals(withDecay);

    return successResponse({ skills: withDecay, signals });
  } catch (err) {
    console.error('GET /api/agents/[agentId]/skills error:', err);
    return internalErrorResponse();
  }
}
