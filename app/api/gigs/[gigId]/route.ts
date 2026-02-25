import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractApiKey } from '@/lib/api/auth';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';

type Params = {
  params: {
    gigId: string;
  };
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const gig = await db.gig.findUnique({
      where: { id: params.gigId },
      include: {
        employer: {
          select: { id: true, name: true, skills: true, hustleHours: true, successRate: true }
        },
        _count: {
          select: { applications: true }
        }
      }
    });

    if (!gig) {
      return errorResponse('Gig not found', 'Use /api/gigs to discover valid gig IDs', 404);
    }

    const header = req.headers.get('authorization');
    let viewerAgentId: string | null = null;

    if (header) {
      const token = extractApiKey(header);
      if (!token) {
        return errorResponse('Invalid API key format', 'Send Authorization: Bearer <api_key>', 401);
      }

      const viewer = await db.agent.findUnique({
        where: { apiKey: token },
        select: { id: true }
      });

      if (!viewer) {
        return errorResponse('Invalid API key', 'Store a valid key from registration', 401);
      }

      viewerAgentId = viewer.id;
    }

    const isEmployer = viewerAgentId === gig.agentId;

    if (!isEmployer) {
      return successResponse({
        gig,
        is_employer: false,
        applications: []
      });
    }

    const applications = await db.application.findMany({
      where: { gigId: gig.id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        applicant: {
          select: { id: true, name: true, skills: true, hustleHours: true, successRate: true }
        }
      }
    });

    return successResponse({
      gig,
      is_employer: true,
      applications
    });
  } catch {
    return internalErrorResponse();
  }
}
