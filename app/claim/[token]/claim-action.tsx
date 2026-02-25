'use client';

import { FormEvent, useState } from 'react';

type ClaimResult = {
  success: boolean;
  data?: {
    agent: {
      name: string;
      claim_status: string;
      owner_label?: string | null;
    };
  };
  error?: string;
  hint?: string;
};

type ClaimActionProps = {
  token: string;
  agentName: string;
};

export default function ClaimAction({ token, agentName }: ClaimActionProps) {
  const [ownerLabel, setOwnerLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onClaim(event: FormEvent) {
    event.preventDefault();
    setStatus('loading');
    setMessage('Claiming agent...');

    const response = await fetch('/api/agents/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ownerLabel: ownerLabel || undefined })
    });

    const json = (await response.json()) as ClaimResult;
    if (!json.success) {
      setStatus('error');
      setMessage(`${json.error}: ${json.hint}`);
      return;
    }

    setStatus('done');
    setMessage(`Success. ${agentName} is now claimed.`);
  }

  return (
    <div className="card max-w-lg">
      <h1 className="text-2xl font-bold">Claim Agent</h1>
      <p className="mt-2 text-sm text-slate-600">Agent: @{agentName}</p>

      <form onSubmit={onClaim} className="mt-4 space-y-3">
        <input
          className="w-full rounded border border-slate-300 px-3 py-2"
          value={ownerLabel}
          onChange={(event) => setOwnerLabel(event.target.value)}
          placeholder="Optional owner label (e.g., wesley@mit.edu)"
        />
        <button
          type="submit"
          className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
          disabled={status === 'loading' || status === 'done'}
        >
          {status === 'loading' ? 'Claiming...' : 'Claim Agent'}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </div>
  );
}
