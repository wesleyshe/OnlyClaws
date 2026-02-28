import { db } from '@/lib/db';

const SIMILARITY_THRESHOLD = 0.4;
const MAX_CLUSTER_SIZE = 5;

export function jaccardSimilarity(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 && tagsB.length === 0) return 0;

  const setA = new Set(tagsA.map(t => t.toLowerCase()));
  const setB = new Set(tagsB.map(t => t.toLowerCase()));
  const intersection = new Set([...setA].filter(t => setB.has(t)));
  const union = new Set([...setA, ...setB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

interface ClusterResult {
  clusterId: string;
  proposals: { id: string; title: string; tags: string[] }[];
}

export function groupIntoClusters(
  proposals: { id: string; title: string; tags: string[] }[]
): ClusterResult[] {
  const clusters: { id: string; centroidTags: string[]; members: typeof proposals }[] = [];
  let clusterIdx = 0;

  for (const p of proposals) {
    let bestCluster: (typeof clusters)[0] | null = null;
    let bestScore = SIMILARITY_THRESHOLD;

    for (const c of clusters) {
      if (c.members.length >= MAX_CLUSTER_SIZE) continue;
      const score = jaccardSimilarity(p.tags, c.centroidTags);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = c;
      }
    }

    if (bestCluster) {
      bestCluster.members.push(p);
      // Merge tags into centroid
      const allTags = new Set([...bestCluster.centroidTags, ...p.tags.map(t => t.toLowerCase())]);
      bestCluster.centroidTags = [...allTags];
    } else {
      clusterIdx++;
      clusters.push({
        id: `cluster_${clusterIdx}`,
        centroidTags: p.tags.map(t => t.toLowerCase()),
        members: [p],
      });
    }
  }

  return clusters.map(c => ({
    clusterId: c.id,
    proposals: c.members,
  }));
}

export async function clusterAndPersist(): Promise<void> {
  const proposals = await db.proposal.findMany({
    where: {
      project: { status: 'PROPOSED' },
    },
    select: { id: true, title: true, tags: true },
  });

  const normalized = proposals.map(p => ({
    id: p.id,
    title: p.title,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
  }));

  const clusters = groupIntoClusters(normalized);

  // Clear old clusters
  await db.proposalCluster.deleteMany();

  // Write new clusters (only multi-proposal clusters)
  for (const c of clusters) {
    if (c.proposals.length < 2) continue;

    const cluster = await db.proposalCluster.create({
      data: {
        title: c.proposals[0].title,
        tagsSummary: [...new Set(c.proposals.flatMap(p => p.tags))],
        proposalIds: c.proposals.map(p => p.id),
        size: c.proposals.length,
      },
    });

    // Update proposals with clusterId
    await db.proposal.updateMany({
      where: { id: { in: c.proposals.map(p => p.id) } },
      data: { clusterId: cluster.id },
    });
  }
}
