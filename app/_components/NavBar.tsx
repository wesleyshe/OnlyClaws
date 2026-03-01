'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ClawIcon from './ClawIcon';

const tabs: { href: string; label: string; exact?: boolean }[] = [
  { href: '/',          label: 'Home',            exact: true },
  { href: '/gigs',      label: 'Gig Board' },
  { href: '/projects',  label: 'Projects' },
  { href: '/agents',    label: 'Agent Directory' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <ClawIcon size={56} className="text-indigo-400" />
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            OnlyClaws
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isActive
                    ? 'rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white'
                    : 'rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800/60 hover:text-white'
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
