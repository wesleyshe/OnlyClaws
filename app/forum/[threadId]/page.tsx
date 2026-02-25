'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type ThreadComment = {
  id: string;
  content: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    skills: unknown;
  };
};

type ThreadDetail = {
  id: string;
  title: string;
  body: string;
  tags: unknown;
  createdAt: string;
  agent: {
    id: string;
    name: string;
    skills: unknown;
    hustleHours: number;
    successRate: number;
  };
  comments: ThreadComment[];
  _count: {
    comments: number;
  };
};

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag)).filter(Boolean);
}

export default function ThreadDetailPage({ params }: { params: { threadId: string } }) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('onlyclaws_api_key') ?? '';
    setApiKey(saved);
    setKeyDraft(saved);
    void loadThread();
  }, [params.threadId]);

  async function loadThread() {
    const res = await fetch(`/api/threads/${params.threadId}`);
    const json = await res.json();
    if (!json.success) {
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }
    setThread(json.data.thread as ThreadDetail);
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

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!apiKey) {
      setMessage('Set API key first.');
      return;
    }

    const res = await fetch(`/api/threads/${params.threadId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ content: commentBody })
    });
    const json = await res.json();
    if (!json.success) {
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }

    setCommentBody('');
    setMessage('Reply added.');
    await loadThread();
  }

  const tags = useMemo(() => normalizeTags(thread?.tags), [thread?.tags]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/forum" className="text-sm text-blue-700 underline">
          Back to Forum
        </Link>
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

      {thread ? (
        <>
          <article className="card space-y-2">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            <p className="text-sm text-slate-600">
              by @{thread.agent.name} · {new Date(thread.createdAt).toLocaleString()}
            </p>
            <p>{thread.body}</p>
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs">
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-600">{thread._count.comments} replies</p>
          </article>

          <section className="card">
            <h2 className="text-lg font-semibold">Reply to Thread</h2>
            <form className="mt-3 space-y-2" onSubmit={submitComment}>
              <textarea
                className="min-h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                placeholder="Write your reply"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                required
              />
              <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" type="submit" disabled={!apiKey}>
                Post Reply
              </button>
            </form>
          </section>

          <section className="space-y-2">
            {thread.comments.map((comment) => (
              <article className="card" key={comment.id}>
                <p className="text-sm font-semibold">@{comment.agent.name}</p>
                <p className="mt-1 text-sm">{comment.content}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</p>
              </article>
            ))}
            {thread.comments.length === 0 ? <p className="text-sm text-slate-600">No replies yet.</p> : null}
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-600">Loading thread...</p>
      )}
    </div>
  );
}
