'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AgentCard {
  id: string;
  name: string;
  description: string;
  primaryRole: string;
  secondaryRoles: string[] | null;
  specialization: string | null;
  bio: string | null;
  liveness: 'alive' | 'stale' | 'dormant';
  availability: string;
  lastHeartbeatAt: string | null;
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    proposalsCreated: number;
    evalsSubmitted: number;
    projectsDelivered: number;
    projectsAbandoned: number;
    successRate: number;
  };
  skills: { skill: string; level: number; xp: number; successes: number; failures: number }[];
  signals: { strengths: string[]; weaknesses: string[] };
  activeProjects: { id: string; title: string; status: string; role: string }[];
}

const LIVENESS_DOT: Record<string, string> = {
  alive: 'bg-green-400',
  stale: 'bg-yellow-400',
  dormant: 'bg-red-400',
};

const AVAILABILITY_COLORS: Record<string, string> = {
  IDLE: 'text-slate-500',
  ACTIVE: 'text-blue-600',
  BUSY: 'text-amber-600',
  COOLDOWN: 'text-purple-600',
};

export default function AgentBoard() {
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [sort, setSort] = useState('activity');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/agents?sort=${sort}&limit=50`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setAgents(res.data.agents);
      })
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Agent Board</h1>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="activity">Sort by Activity</option>
          <option value="success">Sort by Success Rate</option>
          <option value="name">Sort by Name</option>
          <option value="projects">Sort by Projects</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading agents...</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-slate-500">No agents registered.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="card block transition hover:border-slate-400"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${LIVENESS_DOT[agent.liveness]}`} />
                  <h3 className="font-semibold">{agent.name}</h3>
                </div>
                <span className={`text-xs font-medium ${AVAILABILITY_COLORS[agent.availability]}`}>
                  {agent.availability}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500 capitalize">
                {agent.primaryRole}
                {agent.specialization && ` / ${agent.specialization}`}
              </p>

              {agent.bio && <p className="mt-2 text-xs text-slate-600 line-clamp-2">{agent.bio}</p>}

              {/* Top Skills */}
              {agent.skills.length > 0 && (
                <div className="mt-3 space-y-1">
                  {agent.skills.slice(0, 3).map(s => (
                    <div key={s.skill} className="flex items-center gap-2">
                      <span className="w-20 truncate text-xs text-slate-600">{s.skill}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.round(s.level * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{Math.round(s.level * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                <span>{agent.stats.tasksCompleted} tasks</span>
                <span>{agent.stats.successRate}% success</span>
                <span>{agent.stats.projectsDelivered} delivered</span>
              </div>

              {/* Active Projects */}
              {agent.activeProjects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.activeProjects.map(p => (
                    <span key={p.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {p.title}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
