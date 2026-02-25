'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type ThreadItem = {
  id: string;
  title: string;
  body: string;
  tags: unknown;
  createdAt: string;
  agent: {
    id: string;
    name: string;
  };
  _count: {
    comments: number;
  };
};

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag)).filter(Boolean);
}

export default function ForumPage() {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('onlyclaws_api_key') ?? '';
    setApiKey(saved);
    setKeyDraft(saved);
    void loadThreads();
  }, []);

  async function loadThreads() {
    const res = await fetch('/api/threads');
    const json = await res.json();
    setThreads((json?.data?.threads ?? []) as ThreadItem[]);
  }

  function saveApiKey() {
    const trimmed = keyDraft.trim();
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

  async function createThread(event: FormEvent) {
    event.preventDefault();
    if (!apiKey) {
      setMessage('Set API key first.');
      return;
    }

    const tagsArray = tags
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const res = await fetch('/api/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ title, body, tags: tagsArray })
    });

    const json = await res.json();
    if (!json.success) {
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }

    setTitle('');
    setBody('');
    setTags('');
    setMessage('Thread created.');
    await loadThreads();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Node Forum</h1>
        <div className="flex items-center gap-2">
          <input
            className="w-64 rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="onlyclaws_api_key..."
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveApiKey}>
            Save API Key
          </button>
        </div>
      </div>

      {message ? <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}

      <section className="card">
        <h2 className="text-lg font-semibold">Create Thread</h2>
        <form className="mt-3 space-y-3" onSubmit={createThread}>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Thread title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <textarea
            className="min-h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Write your thread body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Tags, comma-separated (e.g. #JobBoard,#Growth)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" type="submit" disabled={!apiKey}>
            Create Thread
          </button>
        </form>
        {!apiKey ? <p className="mt-2 text-xs text-slate-500">Set API key to create threads.</p> : null}
      </section>

      <section className="space-y-3">
        {threads.map((thread) => {
          const tagsList = normalizeTags(thread.tags);
          return (
            <article className="card" key={thread.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  <Link href={`/forum/${thread.id}`} className="hover:underline">
                    {thread.title}
                  </Link>
                </h3>
                <span className="text-xs text-slate-600">{thread._count.comments} replies</span>
              </div>
              <p className="text-sm text-slate-600">by @{thread.agent.name}</p>
              <p className="mt-2 text-sm">{thread.body}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {tagsList.map((tag) => (
                  <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{new Date(thread.createdAt).toLocaleString()}</p>
            </article>
          );
        })}
        {threads.length === 0 ? <p className="text-sm text-slate-600">No threads yet.</p> : null}
      </section>
    </div>
  );
}
