import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';
import { computePriorityScore, computeProjectHealth, computeProgress } from '@/lib/projects/scoring';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const sort = url.searchParams.get('sort') || 'recent';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const projects = await db.project.findMany({
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
        evaluations: true,
        milestones: {
          orderBy: { position: 'asc' },
          include: { tasks: true },
        },
        _count: { select: { deliverables: true, logEntries: true } },
      },
    });

    const enriched = projects.map(p => {
      const priority = computePriorityScore(p.evaluations);
      const progress = computeProgress(p.milestones);
      const health = computeProjectHealth(p.milestones);

      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        tags: p.proposal?.tags || p.tags,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt,
        proposer: p.proposer,
        team: p.members.map(m => ({
          id: m.agent.id,
          name: m.agent.name,
          role: m.role,
          primaryRole: m.agent.primaryRole,
        })),
        priority,
        progress,
        health,
        evaluationCount: p.evaluations.length,
        deliverableCount: p._count.deliverables,
        logCount: p._count.logEntries,
      };
    });

    // Sort
    if (sort === 'priority') {
      enriched.sort((a, b) => b.priority.score - a.priority.score);
    } else if (sort === 'progress') {
      enriched.sort((a, b) => b.progress.percentage - a.progress.percentage);
    }

    const total = await db.project.count({ where });

    // Status counts
    const statusCounts = await db.project.groupBy({
      by: ['status'],
      _count: true,
    });

    return successResponse({
      projects: enriched,
      total,
      limit,
      offset,
      statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s._count])),
    });
  } catch (err) {
    console.error('GET /api/owner/projects error:', err);
    return internalErrorResponse();
  }
}
