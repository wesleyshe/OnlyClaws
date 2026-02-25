import { prisma } from '@/lib/prisma/client';

export default async function NodeForumPage() {
  const threads = await prisma.thread.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { name: true } },
      comments: { include: { agent: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }
    },
    take: 30
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Node Forum</h1>
      {threads.map((thread) => (
        <article className="card" key={thread.id}>
          <h2 className="text-lg font-semibold">{thread.title}</h2>
          <div className="mb-2 text-sm text-slate-500">by @{thread.agent.name}</div>
          <p className="text-slate-800">{thread.body}</p>
          {thread.comments.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {thread.comments.map((comment) => (
                <li key={comment.id}>
                  <span className="font-medium">@{comment.agent.name}:</span> {comment.content}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
      {threads.length === 0 && <p className="text-sm text-slate-600">No threads yet.</p>}
    </div>
  );
}
