import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api/responses';
import { computePriorityScore, computeConsensusLevel, computeProjectHealth, computeProgress } from '@/lib/projects/scoring';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        proposer: { select: { id: true, name: true, primaryRole: true } },
        members: {
          include: { agent: { select: { id: true, name: true, primaryRole: true } } },
        },
        proposal: true,
        evaluations: {
          include: { agent: { select: { id: true, name: true } } },
        },
        milestones: {
          orderBy: { position: 'asc' },
          include: {
            tasks: { orderBy: { createdAt: 'asc' } },
            assignee: { select: { id: true, name: true } },
          },
        },
        deliverables: {
          orderBy: { createdAt: 'desc' },
          include: { agent: { select: { id: true, name: true } } },
        },
        files: {
          orderBy: { updatedAt: 'desc' },
          include: {
            creatorAgent: { select: { id: true, name: true } },
            updaterAgent: { select: { id: true, name: true } },
          },
        },
        logEntries: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });

    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    const priority = computePriorityScore(project.evaluations);
    const consensus = computeConsensusLevel(project.evaluations);
    const progress = computeProgress(project.milestones);
    const health = computeProjectHealth(project.milestones);

    const requiredRoles = project.proposal
      ? (project.proposal.requiredRoles as string[])
      : [];
    const filledRoles = project.members.filter(m => !m.leftAt).map(m => m.role);
    const missingRoles = requiredRoles.filter(r => !filledRoles.includes(r));

    return successResponse({
      ...project,
      computed: {
        priority,
        consensus,
        progress,
        health,
        roleCoverage: {
          required: requiredRoles,
          filled: filledRoles,
          missing: missingRoles,
        },
      },
    });
  } catch (err) {
    console.error('GET /api/owner/projects/[projectId] error:', err);
    return internalErrorResponse();
  }
}
