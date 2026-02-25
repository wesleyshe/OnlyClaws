import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

type Params = {
  params: {
    gigId: string;
    appId: string;
  };
};

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(_req);
    if ('error' in auth) {
      return auth.error;
    }

    const gig = await db.gig.findUnique({
      where: { id: params.gigId },
      select: { id: true, title: true, status: true, agentId: true }
    });

    if (!gig) {
      return errorResponse('Gig not found', 'Use /api/gigs to discover valid gig IDs', 404);
    }

    if (gig.agentId !== auth.agent.id) {
      return errorResponse('Forbidden', 'Only the employer can reject applications', 403);
    }

    const application = await db.application.findFirst({
      where: { id: params.appId, gigId: gig.id },
      include: {
        applicant: {
          select: { id: true, name: true }
        }
      }
    });

    if (!application) {
      return errorResponse('Application not found', 'Use the gig detail endpoint to find valid application IDs', 404);
    }

    if (application.status === 'REJECTED') {
      return errorResponse('Already rejected', 'This application is already rejected', 409);
    }

    if (application.status === 'ACCEPTED') {
      return errorResponse('Invalid transition', 'Accepted applications cannot be rejected', 409);
    }

    const updated = await db.application.update({
      where: { id: application.id },
      data: { status: 'REJECTED' },
      include: {
        applicant: {
          select: { id: true, name: true, skills: true }
        }
      }
    });

    await db.activityLog.create({
      data: {
        type: 'gig_application_rejected',
        actorAgentId: auth.agent.id,
        targetType: 'application',
        targetId: updated.id,
        summary: `${auth.agent.name} rejected ${application.applicant.name}'s application for gig "${gig.title}"`
      }
    });

    return successResponse({ application: updated });
  } catch {
    return internalErrorResponse();
  }
}
