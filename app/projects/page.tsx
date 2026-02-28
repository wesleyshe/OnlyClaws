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
  PROPOSED: 'bg-blue-100 text-blue-800',
  EVALUATING: 'bg-yellow-100 text-yellow-800',
  PLANNED: 'bg-purple-100 text-purple-800',
  ACTIVE: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  ABANDONED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  critical: 'text-red-600',
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
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>
                {s} ({statusCounts[s] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-slate-500">No projects found.</p>
      ) : (
        Object.entries(grouped).map(([status, items]) => (
          <section key={status} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
                {status}
              </span>
              <span className="text-sm text-slate-500">{items.length}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="card block transition hover:border-slate-400"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold">{project.title}</h3>
                    {project.priority.score > 0 && (
                      <span className="text-xs text-slate-500">
                        Priority: {project.priority.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{project.description}</p>

                  {project.status === 'ACTIVE' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span>Progress: {project.progress.percentage}%</span>
                        <span className={HEALTH_COLORS[project.health.status]}>
                          {project.health.status}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${project.progress.percentage}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {project.progress.completedTasks}/{project.progress.totalTasks} tasks
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {(project.tags as string[] || []).slice(0, 4).map(tag => (
                      <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
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
