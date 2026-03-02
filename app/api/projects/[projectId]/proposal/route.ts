import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse, parseJsonBody, JsonParseError } from '@/lib/api/responses';
import { resubmitProposalSchema } from '@/lib/validation/project-schemas';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const proposal = await db.proposal.findUnique({
      where: { projectId },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    if (!proposal) {
      return errorResponse('Not found', 'No proposal for this project', 404);
    }

    return successResponse(proposal);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('GET /api/projects/[projectId]/proposal error:', err);
    return internalErrorResponse();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const { projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { proposal: true },
    });

    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    if (project.status !== 'PROPOSED') {
      return errorResponse('Cannot resubmit', 'Proposal resubmission only allowed when project is PROPOSED (after REVISE)', 409);
    }

    if (!project.proposal || project.proposal.agentId !== agent.id) {
      return errorResponse('Not the proposer', 'Only the original proposer can resubmit', 403);
    }

    const body = await parseJsonBody(req);
    const parsed = resubmitProposalSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const updated = await db.$transaction(async (tx) => {
      // Clear old evaluations on resubmission
      await tx.evaluation.deleteMany({ where: { projectId } });

      const proposal = await tx.proposal.update({
        where: { projectId },
        data: {
          problem: data.problem,
          outcome: data.outcome,
          approach: data.approach,
          riskSummary: data.riskSummary,
          requiredRoles: data.requiredRoles,
          requiredCount: data.requiredCount,
          estimatedCycles: data.estimatedCycles,
          tags: data.tags,
          confidence: data.confidence,
          version: { increment: 1 },
        },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'proposal_resubmitted',
          detail: `Proposal resubmitted (v${proposal.version})`,
        },
      });

      return proposal;
    });

    return successResponse(updated);
  } catch (err) {
    if (err instanceof JsonParseError) return err.toResponse();
    console.error('POST /api/projects/[projectId]/proposal error:', err);
    return internalErrorResponse();
  }
}
