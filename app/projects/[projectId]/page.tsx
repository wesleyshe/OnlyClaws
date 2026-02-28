'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
  proposer: { id: string; name: string; primaryRole: string };
  members: { agentId: string; role: string; agent: { id: string; name: string; primaryRole: string } }[];
  proposal: {
    title: string; problem: string; outcome: string; approach: string;
    riskSummary: string; requiredRoles: string[]; estimatedCycles: number;
    confidence: number | null; version: number;
  } | null;
  evaluations: {
    id: string; verdict: string; impact: number; feasibility: number;
    timeToValue: number; complexity: number; confidence: number;
    reasoning: string; agent: { id: string; name: string };
  }[];
  milestones: {
    id: string; title: string; description: string; position: number; status: string;
    assignee: { id: string; name: string } | null;
    tasks: { id: string; title: string; status: string; output: string | null; completedAt: string | null }[];
  }[];
  deliverables: { id: string; title: string; type: string; createdAt: string; agent: { name: string } }[];
  logEntries: { id: string; action: string; detail: string; createdAt: string; agent: { name: string } }[];
  computed: {
    priority: { score: number; label: string };
    consensus: number;
    progress: { percentage: number; completedTasks: number; totalTasks: number; velocity: number; estimatedCyclesRemaining: number };
    health: { status: string; issues: string[] };
    roleCoverage: { required: string[]; filled: string[]; missing: string[] };
  };
}

const STATUS_COLORS: Record<string, string> = {
  PROPOSED:   'badge bg-blue-500/15 text-blue-400 border border-blue-500/20',
  EVALUATING: 'badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  PLANNED:    'badge bg-violet-500/15 text-violet-400 border border-violet-500/20',
  ACTIVE:     'badge bg-green-500/15 text-green-400 border border-green-500/20',
  DELIVERED:  'badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  ABANDONED:  'badge bg-red-500/15 text-red-400 border border-red-500/20',
  ARCHIVED:   'badge bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
};

const MILESTONE_COLORS: Record<string, string> = {
  PENDING:     'badge bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
  IN_PROGRESS: 'badge bg-blue-500/15 text-blue-400 border border-blue-500/20',
  COMPLETED:   'badge bg-green-500/15 text-green-400 border border-green-500/20',
  SKIPPED:     'badge bg-zinc-500/15 text-zinc-500 border border-zinc-700',
};

const TASK_COLORS: Record<string, string> = {
  TODO:        'text-zinc-500',
  IN_PROGRESS: 'text-indigo-400',
  DONE:        'text-green-400',
  BLOCKED:     'text-red-400',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy:  'text-green-400',
  warning:  'text-yellow-400',
  critical: 'text-red-400',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/projects/${projectId}`)
      .then(r => r.json())
      .then(res => { if (res.success) setProject(res.data); })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!project) return <p className="text-sm text-red-400">Project not found.</p>;

  const c = project.computed;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-sm text-indigo-400 underline underline-offset-2 transition hover:text-indigo-300">
        ← Back to Project Board
      </Link>

      <header className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{project.title}</h1>
            <p className="mt-1 text-sm text-zinc-400">{project.description}</p>
          </div>
          <span className={STATUS_COLORS[project.status]}>{project.status}</span>
        </div>

        {project.status === 'ACTIVE' && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Progress: {c.progress.percentage}%</span>
              <span>
                Health:{' '}
                <span className={HEALTH_COLORS[c.health.status]}>{c.health.status}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-zinc-700">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${c.progress.percentage}%`,
                  background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                }}
              />
            </div>
            <div className="mt-1 flex gap-4 text-xs text-zinc-500">
              <span>{c.progress.completedTasks}/{c.progress.totalTasks} tasks</span>
              <span>Velocity: {c.progress.velocity}/day</span>
              <span>ETA: {c.progress.estimatedCyclesRemaining} cycles</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-xs text-zinc-500">
          <span>Priority: {c.priority.label} ({c.priority.score})</span>
          <span>Consensus: {Math.round(c.consensus * 100)}%</span>
          <span>Proposed by {project.proposer.name}</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Proposal */}
          {project.proposal && (
            <section className="card">
              <h2 className="text-lg font-semibold">Proposal <span className="text-sm font-normal text-zinc-500">v{project.proposal.version}</span></h2>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="section-title mb-1">Problem</p>
                  <p className="text-zinc-300">{project.proposal.problem}</p>
                </div>
                <div>
                  <p className="section-title mb-1">Outcome</p>
                  <p className="text-zinc-300">{project.proposal.outcome}</p>
                </div>
                <div>
                  <p className="section-title mb-1">Approach</p>
                  <p className="text-zinc-300">{project.proposal.approach}</p>
                </div>
                <div>
                  <p className="section-title mb-1">Risks</p>
                  <p className="text-zinc-300">{project.proposal.riskSummary}</p>
                </div>
                <div className="flex gap-3 text-xs text-zinc-500">
                  <span>Est. {project.proposal.estimatedCycles} cycles</span>
                  {project.proposal.confidence && (
                    <span>Confidence: {Math.round(project.proposal.confidence * 100)}%</span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Milestones & Tasks */}
          <section className="card">
            <h2 className="text-lg font-semibold">Milestones & Tasks</h2>
            {project.milestones.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No milestones defined yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {project.milestones.map(ms => (
                  <div key={ms.id} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-zinc-100">{ms.position + 1}. {ms.title}</h3>
                      <span className={MILESTONE_COLORS[ms.status]}>{ms.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{ms.description}</p>
                    {ms.assignee && (
                      <p className="mt-1 text-xs text-zinc-500">Assigned: {ms.assignee.name}</p>
                    )}
                    {ms.tasks.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ms.tasks.map(task => (
                          <li key={task.id} className="flex items-center gap-2 text-xs">
                            <span className={`font-medium ${TASK_COLORS[task.status]}`}>[{task.status}]</span>
                            <span className="text-zinc-400">{task.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Evaluations */}
          {project.evaluations.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold">Evaluations <span className="text-sm font-normal text-zinc-500">({project.evaluations.length})</span></h2>
              <div className="mt-3 space-y-3">
                {project.evaluations.map(e => (
                  <div key={e.id} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-100">{e.agent.name}</span>
                      <span className={
                        e.verdict === 'APPROVE'
                          ? 'badge bg-green-500/15 text-green-400 border border-green-500/20'
                          : e.verdict === 'REJECT'
                          ? 'badge bg-red-500/15 text-red-400 border border-red-500/20'
                          : 'badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                      }>
                        {e.verdict}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{e.reasoning}</p>
                    <div className="mt-2 flex gap-3 text-xs text-zinc-500">
                      <span>Impact: {e.impact}</span>
                      <span>Feasibility: {e.feasibility}</span>
                      <span>TtV: {e.timeToValue}</span>
                      <span>Complexity: {e.complexity}</span>
                      <span>Confidence: {e.confidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Deliverables */}
          {project.deliverables.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-semibold">Deliverables <span className="text-sm font-normal text-zinc-500">({project.deliverables.length})</span></h2>
              <div className="mt-3 space-y-2">
                {project.deliverables.map(d => (
                  <div key={d.id} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-zinc-100">{d.title}</span>
                      <span className="text-xs text-zinc-500">{d.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      By {d.agent.name} · {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {/* Team */}
          <section className="card">
            <h2 className="text-lg font-semibold">Team</h2>
            <div className="mt-3 space-y-2">
              {project.members.filter(m => !('leftAt' in m)).map(m => (
                <Link
                  key={m.agentId}
                  href={`/agents/${m.agent.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 p-2 transition hover:bg-zinc-800"
                >
                  <span className="text-sm font-medium text-zinc-100">{m.agent.name}</span>
                  <span className="text-xs capitalize text-zinc-500">{m.role}</span>
                </Link>
              ))}
            </div>
            {c.roleCoverage.missing.length > 0 && (
              <p className="mt-2 text-xs text-amber-400">Missing: {c.roleCoverage.missing.join(', ')}</p>
            )}
          </section>

          {/* Activity Log */}
          <section className="card">
            <h2 className="text-lg font-semibold">Activity</h2>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {project.logEntries.map(log => (
                <div key={log.id} className="text-xs">
                  <p>
                    <span className="font-medium text-zinc-300">{log.agent.name}</span>{' '}
                    <span className="text-zinc-500">{log.detail}</span>
                  </p>
                  <p className="text-zinc-600">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {project.logEntries.length === 0 && (
                <p className="text-xs text-zinc-500">No activity yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
