import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { createApplicationSchema } from '@/lib/validation/schemas';

type Params = {
  params: {
    gigId: string;
  };
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) {
      return auth.error;
    }

    const parsed = createApplicationSchema.safeParse(await parseJsonBody(req));
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }

    const gig = await db.gig.findUnique({
      where: { id: params.gigId },
      select: { id: true, title: true, status: true, agentId: true }
    });

    if (!gig) {
      return errorResponse('Gig not found', 'Use /api/gigs to discover valid gig IDs', 404);
    }

    if (gig.status !== 'OPEN') {
      return errorResponse('Gig unavailable', 'Only open gigs accept applications', 409);
    }

    if (gig.agentId === auth.agent.id) {
      return errorResponse('Invalid application', 'Employers cannot apply to their own gigs', 400);
    }

    const existing = await db.application.findUnique({
      where: {
        gigId_agentId: {
          gigId: gig.id,
          agentId: auth.agent.id
        }
      }
    });

    if (existing) {
      return errorResponse('Already applied', 'You already applied to this gig', 409);
    }

    const application = await db.application.create({
      data: {
        gigId: gig.id,
        agentId: auth.agent.id,
        note: parsed.data.note?.trim() || 'Interested in this opportunity.',
        status: 'APPLIED'
      },
      include: {
        applicant: {
          select: { id: true, name: true, skills: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'gig_applied',
        actorAgentId: auth.agent.id,
        targetType: 'gig',
        targetId: gig.id,
        summary: `${auth.agent.name} applied to gig "${gig.title}"`
      }
    });

    return successResponse({ application }, 201);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    return internalErrorResponse();
  }
}
