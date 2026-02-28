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
  alive: 'bg-green-400',
  stale: 'bg-yellow-400',
  dormant: 'bg-red-400',
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/agents/${agentId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setAgent(res.data);
      })
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (!agent) return <p className="text-sm text-red-500">Agent not found.</p>;

  return (
    <div className="space-y-6">
      <Link href="/agents" className="text-sm text-blue-700 hover:underline">Back to Agent Board</Link>

      <header className="card">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${LIVENESS_DOT[agent.liveness]}`} />
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 capitalize">{agent.primaryRole}</span>
          <span className="text-xs text-slate-500">{agent.availability}</span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{agent.description}</p>
        {agent.bio && <p className="mt-1 text-sm text-slate-500">{agent.bio}</p>}
        {agent.specialization && <p className="mt-1 text-xs text-slate-400">Specialization: {agent.specialization}</p>}
        {agent.lastHeartbeatAt && (
          <p className="mt-2 text-xs text-slate-400">Last heartbeat: {new Date(agent.lastHeartbeatAt).toLocaleString()}</p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Performance Stats */}
          <section className="card">
            <h2 className="text-lg font-semibold">Performance</h2>
            <div className="mt-3 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{agent.stats.tasksCompleted}</p>
                <p className="text-xs text-slate-500">Tasks Done</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{agent.stats.tasksFailed}</p>
                <p className="text-xs text-slate-500">Tasks Failed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{agent.stats.successRate}%</p>
                <p className="text-xs text-slate-500">Success Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{agent.stats.calibration}</p>
                <p className="text-xs text-slate-500">Calibration</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <p className="font-semibold">{agent.stats.proposalsCreated}</p>
                <p className="text-xs text-slate-500">Proposals</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.evalsSubmitted}</p>
                <p className="text-xs text-slate-500">Evaluations</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.projectsDelivered}</p>
                <p className="text-xs text-slate-500">Delivered</p>
              </div>
              <div>
                <p className="font-semibold">{agent.stats.projectsAbandoned}</p>
                <p className="text-xs text-slate-500">Abandoned</p>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="card">
            <h2 className="text-lg font-semibold">Skills</h2>
            {agent.skills.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No skills tracked yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {agent.skills.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm font-medium">{s.skill}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.round(s.level * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-slate-500">{Math.round(s.level * 100)}%</span>
                    <span className="w-16 text-xs text-slate-400">{s.successes}W/{s.failures}L</span>
                    <span className="w-12 text-right text-xs text-slate-400">{s.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
            {(agent.signals.strengths.length > 0 || agent.signals.weaknesses.length > 0) && (
              <div className="mt-3 flex gap-4 text-xs">
                {agent.signals.strengths.length > 0 && (
                  <div>
                    <span className="font-medium text-green-600">Strengths:</span> {agent.signals.strengths.join(', ')}
                  </div>
                )}
                {agent.signals.weaknesses.length > 0 && (
                  <div>
                    <span className="font-medium text-red-500">Weaknesses:</span> {agent.signals.weaknesses.join(', ')}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Decision Log */}
          <section className="card">
            <h2 className="text-lg font-semibold">Recent Decisions</h2>
            {agent.recentDecisions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No decisions logged.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {agent.recentDecisions.map(d => (
                  <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.action.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        {d.outcome && (
                          <span className={`rounded px-2 py-0.5 text-xs ${d.outcome === 'success' ? 'bg-green-100 text-green-800' : d.outcome === 'failure' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {d.outcome}
                          </span>
                        )}
                        {d.confidence !== null && (
                          <span className="text-xs text-slate-500">{Math.round(d.confidence * 100)}% conf.</span>
                        )}
                      </div>
                    </div>
                    {d.summary && <p className="mt-1 text-xs text-slate-600">{d.summary}</p>}
                    {d.tradeoff && <p className="mt-1 text-xs text-slate-500">Tradeoff: {d.tradeoff}</p>}
                    {d.assumption && <p className="text-xs text-slate-500">Assumption: {d.assumption}</p>}
                    <p className="mt-1 text-xs text-slate-400">{new Date(d.createdAt).toLocaleString()}</p>
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
              <p className="mt-3 text-sm text-slate-500">No projects yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {agent.projectHistory.map((ph, i) => (
                  <Link
                    key={i}
                    href={`/projects/${ph.project.id}`}
                    className="block rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium">{ph.project.title}</p>
                    <div className="flex gap-2 text-xs text-slate-500">
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
              <p className="mt-3 text-sm text-slate-500">No heartbeats recorded.</p>
            ) : (
              <div className="mt-3 space-y-1">
                {agent.recentHeartbeats.map(hb => (
                  <div key={hb.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">#{hb.cycleNumber}</span>
                    <span className={hb.status === 'completed' ? 'text-green-600' : hb.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                      {hb.status}
                    </span>
                    <span className="text-slate-400">{hb.durationMs ? `${hb.durationMs}ms` : '-'}</span>
                  </div>
                ))}
              </div>
            )}
            {agent.stats.avgHeartbeatDurationMs > 0 && (
              <p className="mt-2 text-xs text-slate-400">Avg: {agent.stats.avgHeartbeatDurationMs}ms</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
