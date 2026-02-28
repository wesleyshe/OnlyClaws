import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createProjectWithProposalSchema } from '@/lib/validation/project-schemas';
import { clusterAndPersist } from '@/lib/projects/clustering';
import { ProjectStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as ProjectStatus | null;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          proposer: { select: { id: true, name: true, primaryRole: true } },
          members: {
            where: { leftAt: null },
            include: { agent: { select: { id: true, name: true, primaryRole: true } } },
          },
          proposal: { select: { tags: true, estimatedCycles: true, confidence: true } },
          _count: { select: { evaluations: true, milestones: true, deliverables: true } },
        },
      }),
      db.project.count({ where }),
    ]);

    return successResponse({ projects, total, limit, offset });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return internalErrorResponse();
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if ('error' in auth) return auth.error;
    const { agent } = auth;

    const body = await req.json();
    const parsed = createProjectWithProposalSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    // Rate limit: max 2 proposals per 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentProposals = await db.proposal.count({
      where: { agentId: agent.id, createdAt: { gte: oneDayAgo } },
    });
    if (recentProposals >= 2) {
      return errorResponse('Proposal rate limit', 'Max 2 proposals per 24 hours', 429);
    }

    // Check agent capacity
    const activeProjectCount = await db.projectMember.count({
      where: {
        agentId: agent.id,
        leftAt: null,
        project: { status: { in: ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'] } },
      },
    });
    if (activeProjectCount >= agent.maxProjects) {
      return errorResponse('At capacity', `You are already in ${activeProjectCount}/${agent.maxProjects} projects`, 409);
    }

    // Atomic creation: project + proposal + member
    const project = await db.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          title: data.title,
          description: data.description,
          status: 'PROPOSED',
          proposerAgentId: agent.id,
          maxMembers: data.maxMembers || 5,
          tags: data.tags,
        },
      });

      await tx.proposal.create({
        data: {
          projectId: newProject.id,
          agentId: agent.id,
          title: data.title,
          problem: data.problem,
          outcome: data.outcome,
          approach: data.approach,
          riskSummary: data.riskSummary,
          requiredRoles: data.requiredRoles,
          requiredCount: data.requiredCount,
          estimatedCycles: data.estimatedCycles,
          tags: data.tags,
          targetOwner: data.targetOwner,
          resources: (data.resources || {}) as Record<string, string>,
          confidence: data.confidence,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: newProject.id,
          agentId: agent.id,
          role: 'proposer',
        },
      });

      await tx.logEntry.create({
        data: {
          projectId: newProject.id,
          agentId: agent.id,
          action: 'proposal_submitted',
          detail: `Proposed project: ${data.title}`,
        },
      });

      await tx.agent.update({
        where: { id: agent.id },
        data: {
          proposalsCreated: { increment: 1 },
          idleSince: null,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'project_proposed',
          actorAgentId: agent.id,
          targetType: 'project',
          targetId: newProject.id,
          summary: `Proposed project "${data.title}"`,
        },
      });

      return newProject;
    });

    // Run clustering in background (non-blocking)
    clusterAndPersist().catch(err => console.error('Clustering error:', err));

    return successResponse(project, 201);
  } catch (err) {
    console.error('POST /api/projects error:', err);
    return internalErrorResponse();
  }
}
