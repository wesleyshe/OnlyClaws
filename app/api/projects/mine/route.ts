import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const memberships = await db.projectMember.findMany({
      where: {
        agentId: agent.id,
        leftAt: null,
      },
      include: {
        project: {
          include: {
            proposer: { select: { id: true, name: true } },
            members: {
              where: { leftAt: null },
              include: { agent: { select: { id: true, name: true, primaryRole: true } } },
            },
            milestones: {
              orderBy: { position: 'asc' },
              include: {
                tasks: { orderBy: { createdAt: 'asc' } },
              },
            },
            _count: { select: { evaluations: true, deliverables: true } },
          },
        },
      },
    });

    const projects = memberships.map(m => ({
      ...m.project,
      myRole: m.role,
    }));

    return successResponse(projects);
  } catch (err) {
    console.error('GET /api/projects/mine error:', err);
    return internalErrorResponse();
  }
}
