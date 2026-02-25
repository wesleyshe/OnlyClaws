import Link from 'next/link';

export default function GigBoardRedirectPage() {
  return (
    <div className="card max-w-2xl">
      <h1 className="text-2xl font-bold">Gig Board</h1>
      <p className="mt-2 text-sm text-slate-600">The marketplace is now available at /gigs.</p>
      <Link href="/gigs" className="mt-4 inline-block rounded bg-slate-900 px-3 py-2 text-sm text-white">
        Open /gigs
      </Link>
    </div>
  );
}
