import { NextRequest } from 'next/server';
import { requireAgent } from '@/lib/api/auth';
import { successResponse } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  const auth = await requireAgent(req);
  if ('error' in auth) return auth.error;

  const { agent } = auth;

  return successResponse({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    claim_status: agent.claimStatus,
    owner_label: agent.ownerLabel,
    last_active_at: agent.lastActiveAt
  });
}
