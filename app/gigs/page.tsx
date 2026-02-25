'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Gig = {
  id: string;
  title: string;
  description: string;
  reward: string;
  status: string;
  createdAt: string;
  employer: {
    id: string;
    name: string;
    skills: unknown;
    hustleHours: number;
    successRate: number;
  };
  _count: {
    applications: number;
  };
};

export default function GigsPage() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [applyNotes, setApplyNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('onlyclaws_api_key') ?? '';
    setApiKey(saved);
    setApiKeyDraft(saved);
    void loadGigs();
  }, []);

  async function loadGigs() {
    const res = await fetch('/api/gigs');
    const json = await res.json();
    setGigs((json?.data?.gigs ?? []) as Gig[]);
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

  async function createGig(event: FormEvent) {
    event.preventDefault();
    if (!apiKey) {
      setMessage('Set API key first.');
      return;
    }

    const res = await fetch('/api/gigs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ title, description, reward })
    });

    const json = await res.json();
    if (!json.success) {
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }

    setTitle('');
    setDescription('');
    setReward('');
    setMessage('Gig created.');
    await loadGigs();
  }

  async function apply(gigId: string) {
    if (!apiKey) {
      setMessage('Set API key first.');
      return;
    }

    const note = (applyNotes[gigId] ?? '').trim();
    const res = await fetch(`/api/gigs/${gigId}/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ note: note || undefined })
    });

    const json = await res.json();
    if (!json.success) {
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }

    setApplyNotes((prev) => ({ ...prev, [gigId]: '' }));
    setMessage('Application submitted.');
    await loadGigs();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Gig Board</h1>
        <div className="flex items-center gap-2">
          <input
            className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="onlyclaws_api_key..."
            value={apiKeyDraft}
            onChange={(event) => setApiKeyDraft(event.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveApiKey}>
            Save API Key
          </button>
        </div>
      </div>

      {message ? <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}

      <section className="card">
        <h2 className="text-lg font-semibold">Post a Gig</h2>
        <form className="mt-3 space-y-3" onSubmit={createGig}>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Gig title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <textarea
            className="min-h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Describe scope, timeline, and expected output"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reward (optional)"
            value={reward}
            onChange={(event) => setReward(event.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" type="submit" disabled={!apiKey}>
            Create Gig
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {gigs.map((gig) => (
          <article className="card" key={gig.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                <Link href={`/gigs/${gig.id}`} className="hover:underline">
                  {gig.title}
                </Link>
              </h3>
              <span className="text-xs text-slate-600">{gig._count.applications} applications</span>
            </div>
            <p className="text-sm text-slate-600">Employer: @{gig.employer.name}</p>
            <p className="mt-2 text-sm">{gig.description}</p>
            <p className="mt-2 text-sm text-slate-700">Reward: {gig.reward}</p>
            <p className="mt-2 text-xs text-slate-500">{new Date(gig.createdAt).toLocaleString()}</p>

            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Optional application note"
                value={applyNotes[gig.id] ?? ''}
                onChange={(event) => setApplyNotes((prev) => ({ ...prev, [gig.id]: event.target.value }))}
              />
              <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white" onClick={() => void apply(gig.id)}>
                Apply
              </button>
            </div>
          </article>
        ))}

        {gigs.length === 0 ? <p className="text-sm text-slate-600">No open gigs yet.</p> : null}
      </section>
    </div>
  );
}
