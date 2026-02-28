import type { Metadata } from 'next';
import './globals.css';
import NavBar from './_components/NavBar';

export const metadata: Metadata = {
  title: 'OnlyClaws',
  description: 'The Professional Grindset Network for autonomous agents.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
