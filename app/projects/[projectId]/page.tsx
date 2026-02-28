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
  PROPOSED: 'bg-blue-100 text-blue-800',
  EVALUATING: 'bg-yellow-100 text-yellow-800',
  PLANNED: 'bg-purple-100 text-purple-800',
  ACTIVE: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  ABANDONED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-slate-100 text-slate-600',
};

const MILESTONE_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  SKIPPED: 'bg-slate-100 text-slate-500',
};

const TASK_COLORS: Record<string, string> = {
  TODO: 'text-slate-500',
  IN_PROGRESS: 'text-blue-600',
  DONE: 'text-green-600',
  BLOCKED: 'text-red-600',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/projects/${projectId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setProject(res.data);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (!project) return <p className="text-sm text-red-500">Project not found.</p>;

  const c = project.computed;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-sm text-blue-700 hover:underline">Back to Project Board</Link>

      <header className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{project.description}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[project.status]}`}>
            {project.status}
          </span>
        </div>

        {project.status === 'ACTIVE' && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span>Progress: {c.progress.percentage}%</span>
              <span>Health: <span className={c.health.status === 'healthy' ? 'text-green-600' : c.health.status === 'warning' ? 'text-yellow-600' : 'text-red-600'}>{c.health.status}</span></span>
            </div>
            <div className="mt-1 h-3 rounded-full bg-slate-200">
              <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${c.progress.percentage}%` }} />
            </div>
            <div className="mt-1 flex gap-4 text-xs text-slate-500">
              <span>{c.progress.completedTasks}/{c.progress.totalTasks} tasks</span>
              <span>Velocity: {c.progress.velocity}/day</span>
              <span>ETA: {c.progress.estimatedCyclesRemaining} cycles</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-4 text-xs text-slate-500">
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
              <h2 className="text-lg font-semibold">Proposal (v{project.proposal.version})</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div><strong>Problem:</strong> {project.proposal.problem}</div>
                <div><strong>Outcome:</strong> {project.proposal.outcome}</div>
                <div><strong>Approach:</strong> {project.proposal.approach}</div>
                <div><strong>Risks:</strong> {project.proposal.riskSummary}</div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>Est. {project.proposal.estimatedCycles} cycles</span>
                  {project.proposal.confidence && <span>Confidence: {Math.round(project.proposal.confidence * 100)}%</span>}
                </div>
              </div>
            </section>
          )}

          {/* Milestones & Tasks */}
          <section className="card">
            <h2 className="text-lg font-semibold">Milestones & Tasks</h2>
            {project.milestones.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No milestones defined yet.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {project.milestones.map(ms => (
                  <div key={ms.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{ms.position + 1}. {ms.title}</h3>
                      <span className={`rounded px-2 py-0.5 text-xs ${MILESTONE_COLORS[ms.status]}`}>{ms.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{ms.description}</p>
                    {ms.assignee && <p className="mt-1 text-xs text-slate-500">Assigned: {ms.assignee.name}</p>}
                    {ms.tasks.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {ms.tasks.map(task => (
                          <li key={task.id} className="flex items-center gap-2 text-xs">
                            <span className={`font-medium ${TASK_COLORS[task.status]}`}>[{task.status}]</span>
                            <span>{task.title}</span>
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
              <h2 className="text-lg font-semibold">Evaluations ({project.evaluations.length})</h2>
              <div className="mt-3 space-y-3">
                {project.evaluations.map(e => (
                  <div key={e.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{e.agent.name}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${e.verdict === 'APPROVE' ? 'bg-green-100 text-green-800' : e.verdict === 'REJECT' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {e.verdict}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{e.reasoning}</p>
                    <div className="mt-2 flex gap-3 text-xs text-slate-500">
                      <span>Impact: {e.impact}</span>
                      <span>Feasibility: {e.feasibility}</span>
                      <span>TimeToValue: {e.timeToValue}</span>
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
              <h2 className="text-lg font-semibold">Deliverables ({project.deliverables.length})</h2>
              <div className="mt-3 space-y-2">
                {project.deliverables.map(d => (
                  <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{d.title}</span>
                      <span className="text-xs text-slate-500">{d.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">By {d.agent.name} - {new Date(d.createdAt).toLocaleString()}</p>
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
                <Link key={m.agentId} href={`/agents/${m.agent.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                  <span className="text-sm font-medium">{m.agent.name}</span>
                  <span className="text-xs text-slate-500">{m.role}</span>
                </Link>
              ))}
            </div>
            {c.roleCoverage.missing.length > 0 && (
              <p className="mt-2 text-xs text-amber-600">Missing: {c.roleCoverage.missing.join(', ')}</p>
            )}
          </section>

          {/* Activity Log */}
          <section className="card">
            <h2 className="text-lg font-semibold">Activity</h2>
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
              {project.logEntries.map(log => (
                <div key={log.id} className="text-xs">
                  <p><span className="font-medium">{log.agent.name}</span> {log.detail}</p>
                  <p className="text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
