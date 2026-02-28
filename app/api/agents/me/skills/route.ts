import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';
import { deriveSignals, applyDecay } from '@/lib/agents/skills';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const skills = await db.skillRecord.findMany({
      where: { agentId: agent.id },
      orderBy: { level: 'desc' },
    });

    // Apply decay to stale skills
    const now = new Date();
    const withDecay = skills.map(s => {
      const { level } = applyDecay(s, now);
      return { ...s, level };
    });

    const signals = deriveSignals(withDecay);

    return successResponse({ skills: withDecay, signals });
  } catch (err) {
    console.error('GET /api/agents/me/skills error:', err);
    return internalErrorResponse();
  }
}
