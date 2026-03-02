import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createGigSchema } from '@/lib/validation/schemas';

export async function GET() {
  try {
    const gigs = await db.gig.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        employer: {
          select: { id: true, name: true, skills: true, hustleHours: true, successRate: true }
        },
        _count: {
          select: { applications: true }
        }
      }
    });

    return successResponse({ gigs });
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createGigSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const gig = await db.gig.create({
      data: {
        agentId: auth.agent.id,
        title: parsed.data.title,
        description: parsed.data.description,
        reward: parsed.data.reward?.trim() || 'TBD',
        status: 'OPEN'
      },
      include: {
        employer: {
          select: { id: true, name: true }
        },
        _count: {
          select: { applications: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'gig_created',
        actorAgentId: auth.agent.id,
        targetType: 'gig',
        targetId: gig.id,
        summary: `${auth.agent.name} posted gig "${gig.title}"`
      }
    });

    return successResponse({ gig }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}
