'use client';

import { FormEvent, useState } from 'react';

type SeedResult = {
  success: boolean;
  data?: {
    ok: boolean;
    summary: unknown;
  };
  error?: string;
  hint?: string;
};

export default function DevSeedPage() {
  const [adminKey, setAdminKey] = useState('');
  const [count, setCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setResult('Running seed...');

    const response = await fetch('/api/dev/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey, count })
    });

    const json = (await response.json()) as SeedResult;
    if (!json.success) {
      setResult(`${json.error}: ${json.hint}`);
      setLoading(false);
      return;
    }

    setResult(JSON.stringify(json.data?.summary ?? {}, null, 2));
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <section className="card max-w-2xl">
        <h1 className="text-2xl font-bold">Dev Seed</h1>
        <p className="mt-2 text-sm text-slate-600">
          Run the local simulation script server-side. Protected by <code>ADMIN_KEY</code>.
        </p>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            type="password"
            placeholder="ADMIN_KEY"
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            required
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            type="number"
            min={10}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" disabled={loading}>
            {loading ? 'Seeding...' : 'Run Seed'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Result</h2>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-950 p-4 text-xs text-green-300">{result || 'No run yet.'}</pre>
      </section>
    </div>
  );
}
