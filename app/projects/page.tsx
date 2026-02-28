'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ProjectCard {
  id: string;
  title: string;
  description: string;
  status: string;
  tags: string[];
  createdAt: string;
  proposer: { id: string; name: string; primaryRole: string };
  team: { id: string; name: string; role: string; primaryRole: string }[];
  priority: { score: number; label: string };
  progress: { percentage: number; completedTasks: number; totalTasks: number };
  health: { status: string; issues: string[] };
  evaluationCount: number;
  deliverableCount: number;
}

const STATUS_ORDER = ['ACTIVE', 'PLANNED', 'EVALUATING', 'PROPOSED', 'DELIVERED', 'ABANDONED', 'ARCHIVED'];
const STATUS_COLORS: Record<string, string> = {
  PROPOSED:   'badge bg-blue-500/15 text-blue-400 border border-blue-500/20',
  EVALUATING: 'badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  PLANNED:    'badge bg-violet-500/15 text-violet-400 border border-violet-500/20',
  ACTIVE:     'badge bg-green-500/15 text-green-400 border border-green-500/20',
  DELIVERED:  'badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  ABANDONED:  'badge bg-red-500/15 text-red-400 border border-red-500/20',
  ARCHIVED:   'badge bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy:  'text-green-400',
  warning:  'text-yellow-400',
  critical: 'text-red-400',
};

export default function ProjectBoard() {
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    params.set('limit', '50');

    fetch(`/api/owner/projects?${params}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setProjects(res.data.projects);
          setStatusCounts(res.data.statusCounts || {});
        }
      })
      .finally(() => setLoading(false));
  }, [filter]);

  const grouped = STATUS_ORDER.reduce<Record<string, ProjectCard[]>>((acc, status) => {
    const matching = projects.filter(p => p.status === status);
    if (matching.length > 0) acc[status] = matching;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Board</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="input"
        >
          <option value="">All Statuses</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>
              {s} ({statusCounts[s] || 0})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-zinc-500">No projects found.</p>
      ) : (
        Object.entries(grouped).map(([status, items]) => (
          <section key={status} className="space-y-3">
            <h2 className="flex items-center gap-2.5">
              <span className={STATUS_COLORS[status]}>{status}</span>
              <span className="text-sm text-zinc-500">{items.length}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card card-hover block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-100">{project.title}</h3>
                    {project.priority.score > 0 && (
                      <span className="shrink-0 text-xs text-zinc-500">
                        {project.priority.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{project.description}</p>

                  {project.status === 'ACTIVE' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Progress: {project.progress.percentage}%</span>
                        <span className={HEALTH_COLORS[project.health.status]}>
                          {project.health.status}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-zinc-700">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${project.progress.percentage}%`,
                            background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {project.progress.completedTasks}/{project.progress.totalTasks} tasks
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {(project.tags as string[] || []).slice(0, 4).map(tag => (
                      <span key={tag} className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                    <span>By {project.proposer.name}</span>
                    <span>{project.team.length} members</span>
                    {project.evaluationCount > 0 && <span>{project.evaluationCount} evals</span>}
                    {project.deliverableCount > 0 && <span>{project.deliverableCount} deliverables</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
