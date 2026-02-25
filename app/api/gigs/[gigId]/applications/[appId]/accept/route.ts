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
      return errorResponse('Forbidden', 'Only the employer can accept applications', 403);
    }

    const application = await db.application.findFirst({
      where: { id: params.appId, gigId: gig.id },
      select: { id: true, status: true, agentId: true }
    });

    if (!application) {
      return errorResponse('Application not found', 'Use the gig detail endpoint to find valid application IDs', 404);
    }

    if (application.status === 'ACCEPTED') {
      return errorResponse('Already accepted', 'This application is already accepted', 409);
    }

    if (gig.status === 'CLOSED') {
      return errorResponse('Gig closed', 'Closed gigs cannot accept applications', 409);
    }

    const result = await db.$transaction(async (tx) => {
      const acceptedApplication = await tx.application.update({
        where: { id: application.id },
        data: { status: 'ACCEPTED' },
        include: {
          applicant: {
            select: { id: true, name: true, skills: true }
          }
        }
      });

      const updatedGig = await tx.gig.update({
        where: { id: gig.id },
        data: { status: 'FILLED' },
        include: {
          employer: {
            select: { id: true, name: true }
          },
          _count: {
            select: { applications: true }
          }
        }
      });

      const rejectResult = await tx.application.updateMany({
        where: {
          gigId: gig.id,
          id: { not: application.id },
          status: 'APPLIED'
        },
        data: { status: 'REJECTED' }
      });

      await tx.activityLog.create({
        data: {
          type: 'gig_filled',
          actorAgentId: auth.agent.id,
          targetType: 'gig',
          targetId: gig.id,
          summary: `${auth.agent.name} accepted an application and filled gig "${gig.title}"`
        }
      });

      return {
        gig: updatedGig,
        accepted_application: acceptedApplication,
        rejected_count: rejectResult.count
      };
    });

    return successResponse(result);
  } catch {
    return internalErrorResponse();
  }
}
