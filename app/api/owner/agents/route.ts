import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, internalErrorResponse } from '@/lib/api/responses';
import { deriveSignals, applyDecay } from '@/lib/agents/skills';
import { getAvailability } from '@/lib/agents/availability';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get('sort') || 'activity';
    const role = url.searchParams.get('role');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (role) where.primaryRole = role;

    const agents = await db.agent.findMany({
      where,
      orderBy: { lastActiveAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        skillRecords: { orderBy: { level: 'desc' }, take: 5 },
        projectMembers: {
          where: { leftAt: null },
          include: {
            project: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });

    const now = new Date();
    const enriched = agents.map(a => {
      // Compute liveness
      let liveness: 'alive' | 'stale' | 'dormant' = 'dormant';
      if (a.lastHeartbeatAt) {
        const minutesSince = (now.getTime() - a.lastHeartbeatAt.getTime()) / 60_000;
        if (minutesSince <= 20) liveness = 'alive';
        else if (minutesSince <= 60) liveness = 'stale';
      }

      // Active project count
      const activeProjects = a.projectMembers.filter(m =>
        ['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE'].includes(m.project.status)
      );

      const availability = getAvailability(a, activeProjects.length);

      // Skills with decay
      const skillsWithDecay = a.skillRecords.map(s => ({
        skill: s.skill,
        level: applyDecay(s, now).level,
        xp: s.xp,
        successes: s.successes,
        failures: s.failures,
      }));
      const signals = deriveSignals(a.skillRecords);

      // Success rate
      const totalTasks = a.tasksCompleted + a.tasksFailed;
      const successRate = totalTasks > 0 ? Math.round((a.tasksCompleted / totalTasks) * 100) : 0;

      return {
        id: a.id,
        name: a.name,
        description: a.description,
        primaryRole: a.primaryRole,
        secondaryRoles: a.secondaryRoles,
        specialization: a.specialization,
        bio: a.bio,
        createdAt: a.createdAt,
        liveness,
        availability,
        lastHeartbeatAt: a.lastHeartbeatAt,
        stats: {
          tasksCompleted: a.tasksCompleted,
          tasksFailed: a.tasksFailed,
          proposalsCreated: a.proposalsCreated,
          evalsSubmitted: a.evalsSubmitted,
          projectsDelivered: a.projectsDelivered,
          projectsAbandoned: a.projectsAbandoned,
          successRate,
        },
        skills: skillsWithDecay,
        signals,
        activeProjects: activeProjects.map(m => ({
          id: m.project.id,
          title: m.project.title,
          status: m.project.status,
          role: m.role,
        })),
      };
    });

    // Sort
    if (sort === 'success') {
      enriched.sort((a, b) => b.stats.successRate - a.stats.successRate);
    } else if (sort === 'name') {
      enriched.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'projects') {
      enriched.sort((a, b) => b.stats.projectsDelivered - a.stats.projectsDelivered);
    }

    const total = await db.agent.count({ where });

    return successResponse({ agents: enriched, total, limit, offset });
  } catch (err) {
    console.error('GET /api/owner/agents error:', err);
    return internalErrorResponse();
  }
}
