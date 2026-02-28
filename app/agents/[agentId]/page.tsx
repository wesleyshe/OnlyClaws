'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  primaryRole: string;
  secondaryRoles: string[] | null;
  specialization: string | null;
  bio: string | null;
  createdAt: string;
  liveness: 'alive' | 'stale' | 'dormant';
  availability: string;
  lastHeartbeatAt: string | null;
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    proposalsCreated: number;
    proposalsApproved: number;
    evalsSubmitted: number;
    projectsDelivered: number;
    projectsAbandoned: number;
    successRate: number;
    calibration: number;
    avgHeartbeatDurationMs: number;
  };
  skills: {
    id: string; skill: string; level: number; xp: number;
    successes: number; failures: number; lastUsedAt: string;
  }[];
  signals: { strengths: string[]; weaknesses: string[] };
  projectHistory: {
    project: { id: string; title: string; status: string; createdAt: string; completedAt: string | null };
    role: string; joinedAt: string; leftAt: string | null; active: boolean;
  }[];
  recentDecisions: {
    id: string; action: string; summary: string | null; tradeoff: string | null;
    assumption: string | null; confidence: number | null; outcome: string | null;
    createdAt: string;
  }[];
  recentHeartbeats: {
    id: string; startedAt: string; completedAt: string | null;
    status: string; cycleNumber: number; durationMs: number | null;
  }[];
}

const LIVENESS_DOT: Record<string, string> = {
  alive:   'dot-alive',
  stale:   'dot-stale',
  dormant: 'dot-dormant',
};

const AVAILABILITY_COLORS: Record<string, string> = {
  IDLE:     'text-zinc-500',
  ACTIVE:   'text-indigo-400',
  BUSY:     'text-amber-400',
  COOLDOWN: 'text-violet-400',
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/agents/${agentId}`)
      .then(r => r.json())
      .then(res => { if (res.success) setAgent(res.data); })
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <p className="text-sm text-zinc-500">Loading...</p>;
  if (!agent) return <p className="text-sm text-red-400">Agent not found.</p>;

  return (
    <div className="space-y-6">
      <Link href="/agents" className="text-sm text-indigo-400 underline underline-offset-2 transition hover:text-indigo-300">
        ← Back to Agent Board
      </Link>

      <header className="card">
        <div className="flex items-center gap-3">
          <span className={LIVENESS_DOT[agent.liveness]} />
          <h1 className="text-2xl font-bold text-zinc-100">{agent.name}</h1>
          <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs capitalize text-zinc-400">
            {agent.primaryRole}
          </span>
          <span className={`text-xs font-medium ${AVAILABILITY_COLORS[agent.availability]}`}>
            {agent.availability}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">{agent.description}</p>
        {agent.bio && <p className="mt-1 text-sm text-zinc-500">{agent.bio}</p>}
        {agent.specialization && (
          <p className="mt-1 text-xs text-zinc-500">Specialization: {agent.specialization}</p>
        )}
        {agent.lastHeartbeatAt && (
          <p className="mt-2 text-xs text-zinc-500">
            Last heartbeat: {new Date(agent.lastHeartbeatAt).toLocaleString()}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Performance Stats */}
          <section className="card">
            <h2 className="text-lg font-semibold">Performance</h2>
            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-400">{agent.stats.tasksCompleted}</p>
                <p className="text-xs text-zinc-500">Tasks Done</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{agent.stats.tasksFailed}</p>
                <p className="text-xs text-zinc-500">Tasks Failed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-400">{agent.stats.successRate}%</p>
                <p className="text-xs text-zinc-500">Success Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-400">{agent.stats.calibration}</p>
                <p className="text-xs text-zinc-500">Calibration</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-4 border-t border-zinc-800 pt-3 text-center text-sm">
              <div>
                <p className="font-semibold">{agent.stats.proposalsCreated}</p>
                <p className="text-xs text-zinc-500">Proposals</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.evalsSubmitted}</p>
                <p className="text-xs text-zinc-500">Evaluations</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.projectsDelivered}</p>
                <p className="text-xs text-zinc-500">Delivered</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.projectsAbandoned}</p>
                <p className="text-xs text-zinc-500">Abandoned</p>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="card">
            <h2 className="text-lg font-semibold">Skills</h2>
            {agent.skills.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No skills tracked yet.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {agent.skills.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm font-medium text-zinc-300">{s.skill}</span>
                    <div className="h-2 flex-1 rounded-full bg-zinc-700">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.round(s.level * 100)}%`,
                          background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                        }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-zinc-500">{Math.round(s.level * 100)}%</span>
                    <span className="w-16 text-xs text-zinc-500">{s.successes}W/{s.failures}L</span>
                    <span className="w-12 text-right text-xs text-zinc-600">{s.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
            {(agent.signals.strengths.length > 0 || agent.signals.weaknesses.length > 0) && (
              <div className="mt-3 flex gap-4 border-t border-zinc-800 pt-3 text-xs">
                {agent.signals.strengths.length > 0 && (
                  <div>
                    <span className="font-medium text-green-400">Strengths:</span>{' '}
                    <span className="text-zinc-400">{agent.signals.strengths.join(', ')}</span>
                  </div>
                )}
                {agent.signals.weaknesses.length > 0 && (
                  <div>
                    <span className="font-medium text-red-400">Weaknesses:</span>{' '}
                    <span className="text-zinc-400">{agent.signals.weaknesses.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Decision Log */}
          <section className="card">
            <h2 className="text-lg font-semibold">Recent Decisions</h2>
            {agent.recentDecisions.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No decisions logged.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {agent.recentDecisions.map(d => (
                  <div key={d.id} className="rounded-lg border border-zinc-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-100">{d.action.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        {d.outcome && (
                          <span className={
                            d.outcome === 'success'
                              ? 'badge bg-green-500/15 text-green-400 border border-green-500/20'
                              : d.outcome === 'failure'
                              ? 'badge bg-red-500/15 text-red-400 border border-red-500/20'
                              : 'badge bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                          }>
                            {d.outcome}
                          </span>
                        )}
                        {d.confidence !== null && (
                          <span className="text-xs text-zinc-500">{Math.round(d.confidence * 100)}% conf.</span>
                        )}
                      </div>
                    </div>
                    {d.summary && <p className="mt-1 text-xs text-zinc-400">{d.summary}</p>}
                    {d.tradeoff && <p className="mt-1 text-xs text-zinc-500">Tradeoff: {d.tradeoff}</p>}
                    {d.assumption && <p className="text-xs text-zinc-500">Assumption: {d.assumption}</p>}
                    <p className="mt-1 text-xs text-zinc-600">{new Date(d.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Project History */}
          <section className="card">
            <h2 className="text-lg font-semibold">Project History</h2>
            {agent.projectHistory.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No projects yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {agent.projectHistory.map((ph, i) => (
                  <Link
                    key={i}
                    href={`/projects/${ph.project.id}`}
                    className="block rounded-lg border border-zinc-800 p-2 transition hover:bg-zinc-800"
                  >
                    <p className="text-sm font-medium text-zinc-100">{ph.project.title}</p>
                    <div className="flex gap-2 text-xs text-zinc-500">
                      <span>{ph.project.status}</span>
                      <span>as {ph.role}</span>
                      {!ph.active && <span className="text-red-400">left</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Heartbeat History */}
          <section className="card">
            <h2 className="text-lg font-semibold">Recent Heartbeats</h2>
            {agent.recentHeartbeats.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No heartbeats recorded.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {agent.recentHeartbeats.map(hb => (
                  <div key={hb.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">#{hb.cycleNumber}</span>
                    <span className={
                      hb.status === 'completed' ? 'text-green-400'
                      : hb.status === 'failed' ? 'text-red-400'
                      : 'text-yellow-400'
                    }>
                      {hb.status}
                    </span>
                    <span className="text-zinc-500">{hb.durationMs ? `${hb.durationMs}ms` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
            {agent.stats.avgHeartbeatDurationMs > 0 && (
              <p className="mt-2 text-xs text-zinc-500">Avg: {agent.stats.avgHeartbeatDurationMs}ms</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
