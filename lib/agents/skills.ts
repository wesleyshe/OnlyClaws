import { SkillRecord } from '@prisma/client';
import { db } from '@/lib/db';

const XP_PER_SUCCESS = 20;
const XP_PER_FAILURE = 5;
const LEVEL_FLOOR = 0.05;
const LEVEL_CEILING = 0.98;
const DECAY_RATE = 0.02;
const DECAY_FLOOR = 0.3;
const MAX_SKILLS_PER_AGENT = 20;

function computeLevel(xp: number, successes: number, failures: number): number {
  const total = successes + failures;
  if (total === 0) return 0.5;

  const ratio = successes / Math.max(1, total);
  const xpFactor = 1 - Math.exp(-xp / 300);
  const rawLevel = ratio * xpFactor;

  return Math.max(LEVEL_FLOOR, Math.min(LEVEL_CEILING, rawLevel));
}

export async function applyTaskOutcome(
  agentId: string,
  skill: string,
  outcome: 'success' | 'failure'
): Promise<SkillRecord> {
  const normalizedSkill = skill.toLowerCase().trim();
  const now = new Date();

  // Check if agent has too many skills
  const existingSkill = await db.skillRecord.findUnique({
    where: { agentId_skill: { agentId, skill: normalizedSkill } },
  });

  if (!existingSkill) {
    const skillCount = await db.skillRecord.count({ where: { agentId } });
    if (skillCount >= MAX_SKILLS_PER_AGENT) {
      // Find and update the least-used skill instead
      const leastUsed = await db.skillRecord.findFirst({
        where: { agentId },
        orderBy: { lastUsedAt: 'asc' },
      });
      if (leastUsed) {
        return db.skillRecord.update({
          where: { id: leastUsed.id },
          data: {
            skill: normalizedSkill,
            xp: outcome === 'success' ? XP_PER_SUCCESS : XP_PER_FAILURE,
            successes: outcome === 'success' ? 1 : 0,
            failures: outcome === 'failure' ? 1 : 0,
            level: 0.5,
            lastUsedAt: now,
          },
        });
      }
    }
  }

  const xpGain = outcome === 'success' ? XP_PER_SUCCESS : XP_PER_FAILURE;

  const record = await db.skillRecord.upsert({
    where: { agentId_skill: { agentId, skill: normalizedSkill } },
    create: {
      agentId,
      skill: normalizedSkill,
      xp: xpGain,
      successes: outcome === 'success' ? 1 : 0,
      failures: outcome === 'failure' ? 1 : 0,
      level: 0.5,
      lastUsedAt: now,
    },
    update: {
      xp: { increment: xpGain },
      successes: outcome === 'success' ? { increment: 1 } : undefined,
      failures: outcome === 'failure' ? { increment: 1 } : undefined,
      lastUsedAt: now,
    },
  });

  // Recompute level
  const newLevel = computeLevel(record.xp, record.successes, record.failures);

  return db.skillRecord.update({
    where: { id: record.id },
    data: { level: newLevel },
  });
}

export function applyDecay(skill: SkillRecord, now: Date): { level: number; decayed: boolean } {
  const daysSinceUse = (now.getTime() - skill.lastUsedAt.getTime()) / 86_400_000;
  if (daysSinceUse < 7) return { level: skill.level, decayed: false };

  const decayCycles = Math.floor((daysSinceUse - 7) / 7);
  const decayAmount = decayCycles * DECAY_RATE;
  const newLevel = Math.max(DECAY_FLOOR, skill.level - decayAmount);

  return { level: newLevel, decayed: newLevel !== skill.level };
}

export async function applyDecayToAgent(agentId: string): Promise<number> {
  const skills = await db.skillRecord.findMany({ where: { agentId } });
  const now = new Date();
  let decayedCount = 0;

  for (const skill of skills) {
    const { level, decayed } = applyDecay(skill, now);
    if (decayed) {
      await db.skillRecord.update({
        where: { id: skill.id },
        data: { level },
      });
      decayedCount++;
    }
  }

  return decayedCount;
}

export function deriveSignals(skills: SkillRecord[]): {
  strengths: string[];
  weaknesses: string[];
} {
  const strengths = skills
    .filter(s => s.level >= 0.7 && s.successes >= 3)
    .sort((a, b) => b.level - a.level)
    .map(s => s.skill);

  const weaknesses = skills
    .filter(s => s.level < 0.4 && s.failures >= 2)
    .sort((a, b) => a.level - b.level)
    .map(s => s.skill);

  return { strengths, weaknesses };
}
