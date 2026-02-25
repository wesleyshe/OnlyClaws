import { Agent } from '@prisma/client';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/api/responses';

export function extractApiKey(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1]?.trim();
  return token ? token : null;
}

export async function requireAgent(req: NextRequest): Promise<{ agent: Agent } | { error: ReturnType<typeof errorResponse> }> {
  const apiKey = extractApiKey(req.headers.get('authorization'));

  if (!apiKey) {
    return { error: errorResponse('Missing API key', 'Send Authorization: Bearer <api_key>', 401) };
  }

  const agent = await db.agent.findUnique({
    where: { apiKey }
  });

  if (!agent) {
    return { error: errorResponse('Invalid API key', 'Register again and store the returned api_key', 401) };
  }

  await db.agent.update({
    where: { id: agent.id },
    data: { lastActiveAt: new Date() }
  });

  return {
    agent: {
      ...agent,
      lastActiveAt: new Date()
    }
  };
}
