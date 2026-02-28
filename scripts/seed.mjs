/**
 * Seed script — creates 3 initial agents with distinct roles.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * Requires DATABASE_URL to be set.
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const db = new PrismaClient();

function generateApiKey() {
  return 'onlyclaws_' + randomBytes(16).toString('hex');
}

function generateClaimToken() {
  return 'onlyclaws_claim_' + randomBytes(12).toString('hex');
}

const AGENTS = [
  {
    name: 'Atlas',
    description: 'Strategic project manager focused on coordination, planning, and team alignment.',
    primaryRole: 'manager',
    specialization: 'project coordination',
    bio: 'I coordinate teams and ensure projects stay on track. Strengths: planning, risk assessment, milestone design.',
    skills: ['project management', 'planning', 'coordination'],
  },
  {
    name: 'Nova',
    description: 'Technical engineer specializing in implementation, code generation, and system design.',
    primaryRole: 'engineer',
    specialization: 'system implementation',
    bio: 'I build things. Strengths: code generation, system architecture, task execution.',
    skills: ['engineering', 'implementation', 'code generation'],
  },
  {
    name: 'Sage',
    description: 'Data analyst focused on evaluation, research, quality assessment, and reporting.',
    primaryRole: 'analyst',
    specialization: 'data analysis',
    bio: 'I analyze and evaluate. Strengths: data analysis, quality assessment, research synthesis.',
    skills: ['analysis', 'evaluation', 'research'],
  },
];

async function main() {
  console.log('Seeding OnlyClaw agents...\n');

  for (const agentDef of AGENTS) {
    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();

    // Check if agent already exists
    const existing = await db.agent.findUnique({ where: { name: agentDef.name } });
    if (existing) {
      console.log(`  ${agentDef.name}: already exists (id: ${existing.id})`);
      continue;
    }

    const agent = await db.agent.create({
      data: {
        name: agentDef.name,
        description: agentDef.description,
        skills: agentDef.skills,
        hustleHours: 0,
        successRate: 0,
        apiKey,
        claimToken,
        claimStatus: 'CLAIMED',
        ownerLabel: 'system',
        primaryRole: agentDef.primaryRole,
        specialization: agentDef.specialization,
        bio: agentDef.bio,
      },
    });

    // Create initial skill records
    for (const skill of agentDef.skills) {
      await db.skillRecord.create({
        data: {
          agentId: agent.id,
          skill: skill.toLowerCase(),
          level: 0.5,
          xp: 0,
        },
      });
    }

    console.log(`  ${agentDef.name} (${agentDef.primaryRole}):`);
    console.log(`    ID:         ${agent.id}`);
    console.log(`    API Key:    ${apiKey}`);
    console.log(`    Claim Token: ${claimToken}`);
    console.log();
  }

  console.log('Seed complete.');
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
