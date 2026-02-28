import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAgent } from '@/lib/api/auth';
import { successResponse, errorResponse, zodErrorResponse, internalErrorResponse } from '@/lib/api/responses';
import { createEvaluationSchema } from '@/lib/validation/project-schemas';
import { transitionProject, buildTransitionContext, canTransition } from '@/lib/projects/lifecycle';
import { ProjectStatus, EvalVerdict } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const evaluations = await db.evaluation.findMany({
      where: { projectId },
      include: {
        agent: { select: { id: true, name: true, primaryRole: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(evaluations);
  } catch (err) {
    console.error('GET /api/projects/[projectId]/evaluations error:', err);
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

    const body = await req.json();
    const parsed = createEvaluationSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const data = parsed.data;

    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return errorResponse('Not found', 'Project does not exist', 404);
    }

    if (!['PROPOSED', 'EVALUATING'].includes(project.status)) {
      return errorResponse('Cannot evaluate', `Project is ${project.status} — evaluations only in PROPOSED/EVALUATING`, 409);
    }

    // Check for duplicate evaluation
    const existing = await db.evaluation.findUnique({
      where: { projectId_agentId: { projectId, agentId: agent.id } },
    });
    if (existing) {
      return errorResponse('Already evaluated', 'You have already submitted an evaluation', 409);
    }

    // Cannot evaluate own proposal
    if (project.proposerAgentId === agent.id) {
      return errorResponse('Cannot self-evaluate', 'You cannot evaluate your own project', 403);
    }

    const evaluation = await db.$transaction(async (tx) => {
      const eval_ = await tx.evaluation.create({
        data: {
          projectId,
          agentId: agent.id,
          verdict: data.verdict as EvalVerdict,
          impact: data.impact,
          feasibility: data.feasibility,
          timeToValue: data.timeToValue,
          complexity: data.complexity,
          confidence: data.confidence,
          reasoning: data.reasoning,
          strengths: data.strengths || [],
          risks: data.risks || [],
          suggestions: data.suggestions || [],
        },
      });

      await tx.agent.update({
        where: { id: agent.id },
        data: { evalsSubmitted: { increment: 1 } },
      });

      await tx.logEntry.create({
        data: {
          projectId,
          agentId: agent.id,
          action: 'evaluation_added',
          detail: `Evaluated: ${data.verdict} (impact=${data.impact}, feasibility=${data.feasibility})`,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'evaluation_submitted',
          actorAgentId: agent.id,
          targetType: 'project',
          targetId: projectId,
          summary: `Evaluated "${project.title}": ${data.verdict}`,
        },
      });

      // Auto-transition PROPOSED → EVALUATING on first evaluation (if a member exists)
      if (project.status === 'PROPOSED') {
        const ctx = await buildTransitionContext(projectId);
        // Account for the eval we just created
        const updatedCtx = { ...ctx, evaluationCount: ctx.evaluationCount + 1 };
        if (updatedCtx.memberCount >= 1) {
          await tx.project.update({
            where: { id: projectId },
            data: { status: 'EVALUATING' },
          });
          await tx.logEntry.create({
            data: {
              projectId,
              agentId: agent.id,
              action: 'status_changed',
              detail: 'Status changed from PROPOSED to EVALUATING (auto)',
              metadata: { from: 'PROPOSED', to: 'EVALUATING', trigger: 'first_evaluation' },
            },
          });
        }
      }

      return eval_;
    });

    // Check for auto-transition based on consensus (after transaction)
    const allEvals = await db.evaluation.findMany({ where: { projectId } });
    if (allEvals.length >= 2) {
      const ctx = await buildTransitionContext(projectId);
      const currentProject = await db.project.findUnique({ where: { id: projectId } });
      if (currentProject?.status === 'EVALUATING') {
        // Check APPROVE majority → PLANNED
        if (canTransition('EVALUATING' as ProjectStatus, 'PLANNED' as ProjectStatus, ctx).allowed) {
          await transitionProject(projectId, 'PLANNED' as ProjectStatus, agent.id);
        }
        // Check REJECT majority → ABANDONED
        else if (canTransition('EVALUATING' as ProjectStatus, 'ABANDONED' as ProjectStatus, ctx).allowed) {
          await transitionProject(projectId, 'ABANDONED' as ProjectStatus, agent.id);
        }
        // Check REVISE majority → PROPOSED
        else if (canTransition('EVALUATING' as ProjectStatus, 'PROPOSED' as ProjectStatus, ctx).allowed) {
          await transitionProject(projectId, 'PROPOSED' as ProjectStatus, agent.id);
        }
      }
    }

    return successResponse(evaluation, 201);
  } catch (err) {
    console.error('POST /api/projects/[projectId]/evaluations error:', err);
    return internalErrorResponse();
  }
}
