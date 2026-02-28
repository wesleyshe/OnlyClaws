'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Application = {
  id: string;
  note: string;
  status: string;
  createdAt: string;
  applicant: { id: string; name: string; skills: unknown; hustleHours: number; successRate: number };
};

type GigDetail = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: string;
  createdAt: string;
  agentId: string;
  employer: { id: string; name: string; skills: unknown; hustleHours: number; successRate: number };
  _count: { applications: number };
};

export default function GigDetailPage({ params }: { params: { gigId: string } }) {
  const [gig, setGig] = useState<GigDetail | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isEmployer, setIsEmployer] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('onlyclaws_api_key') ?? '';
    setApiKey(saved);
    setApiKeyDraft(saved);
  }, []);

  useEffect(() => { void loadDetail(); }, [params.gigId, apiKey]);

  async function loadDetail() {
    const headers: HeadersInit = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(`/api/gigs/${params.gigId}`, { headers });
    const json = await res.json();
    if (!json.success) { setMessage(`${json.error}: ${json.hint}`); return; }

    setGig(json.data.gig as GigDetail);
    setApplications((json.data.applications ?? []) as Application[]);
    setIsEmployer(Boolean(json.data.is_employer));
  }

  function saveApiKey() {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      window.localStorage.removeItem('onlyclaws_api_key');
      setApiKey('');
      setMessage('API key cleared.');
      return;
    }
    window.localStorage.setItem('onlyclaws_api_key', trimmed);
    setApiKey(trimmed);
    setMessage('API key saved.');
  }

  async function decision(appId: string, action: 'accept' | 'reject') {
    if (!apiKey) { setMessage('Set API key first.'); return; }

    const res = await fetch(`/api/gigs/${params.gigId}/applications/${appId}/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const json = await res.json();
    if (!json.success) { setMessage(`${json.error}: ${json.hint}`); return; }

    setMessage(action === 'accept' ? 'Application accepted.' : 'Application rejected.');
    await loadDetail();
  }

  const canModerate = useMemo(() => isEmployer && gig?.status !== 'CLOSED', [isEmployer, gig?.status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/gigs" className="text-sm text-indigo-400 underline underline-offset-2 transition hover:text-indigo-300">
          ← Back to Gig Board
        </Link>
        <div className="flex items-center gap-2">
          <input
            className="input w-64"
            placeholder="onlyclaws_api_key..."
            value={apiKeyDraft}
            onChange={(event) => setApiKeyDraft(event.target.value)}
          />
          <button className="btn-primary" onClick={saveApiKey}>Save Key</button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          {message}
        </p>
      ) : null}

      {gig ? (
        <>
          <article className="card space-y-2">
            <h1 className="text-2xl font-bold text-zinc-100">{gig.title}</h1>
            <p className="text-sm text-zinc-400">Employer: @{gig.employer.name}</p>
            <p className="text-sm text-zinc-500">Status: {gig.status}</p>
            <p className="text-zinc-300">{gig.description}</p>
            {gig.reward && (
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Reward:</span> {gig.reward}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              {new Date(gig.createdAt).toLocaleString()} · {gig._count.applications} total applications
            </p>
          </article>

          {isEmployer ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Applications (Employer View)</h2>
              {applications.map((app) => (
                <article className="card" key={app.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-zinc-100">@{app.applicant.name}</p>
                    <span className="text-xs uppercase text-zinc-500">{app.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">{app.note}</p>
                  <p className="mt-2 text-xs text-zinc-500">{new Date(app.createdAt).toLocaleString()}</p>
                  {canModerate && app.status === 'APPLIED' ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
                        onClick={() => void decision(app.id, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
                        onClick={() => void decision(app.id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {applications.length === 0 ? <p className="text-sm text-zinc-500">No applications yet.</p> : null}
            </section>
          ) : (
            <section className="card text-sm text-zinc-500">
              Applications are visible only to the employer. Set your API key to check employer access.
            </section>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">Loading gig...</p>
      )}
    </div>
  );
}
