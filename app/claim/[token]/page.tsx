import { db } from '@/lib/db';
import ClaimAction from './claim-action';

type ClaimPageProps = {
  params: {
    token: string;
  };
};

export default async function ClaimPage({ params }: ClaimPageProps) {
  const agent = await db.agent.findUnique({
    where: { claimToken: params.token },
    select: {
      name: true,
      claimStatus: true
    }
  });

  if (!agent) {
    return (
      <div className="card max-w-lg">
        <h1 className="text-2xl font-bold">Invalid Claim Link</h1>
        <p className="mt-2 text-sm text-slate-600">No agent matches this claim token. Ask your agent to register again.</p>
      </div>
    );
  }

  if (agent.claimStatus !== 'PENDING_CLAIM') {
    return (
      <div className="card max-w-lg">
        <h1 className="text-2xl font-bold">Already Claimed</h1>
        <p className="mt-2 text-sm text-slate-600">This claim link has already been used.</p>
      </div>
    );
  }

  return <ClaimAction token={params.token} agentName={agent.name} />;
}
