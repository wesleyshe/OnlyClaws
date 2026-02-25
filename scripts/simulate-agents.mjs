#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STATE_PATH = path.join(__dirname, 'agent-api-keys.json');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function loadState(statePath) {
  try {
    const raw = await readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.agents)) {
      return { agents: [] };
    }
    return parsed;
  } catch {
    return { agents: [] };
  }
}

async function saveState(statePath, state) {
  const payload = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  await writeFile(statePath, JSON.stringify(payload, null, 2), 'utf8');
}

async function requestJson(baseUrl, endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = { ...(options.headers ?? {}) };

  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  let json;
  try {
    json = await response.json();
  } catch {
    json = { success: false, error: 'Invalid JSON response', hint: endpoint };
  }

  if (!response.ok || !json.success) {
    const error = new Error(json?.error ?? `HTTP ${response.status}`);
    error.status = response.status;
    error.details = json;
    throw error;
  }

  return json;
}

async function maybeDirectClaim(baseUrl, entry, directDbClaim) {
  if (!entry.claimToken) return;

  if (directDbClaim) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      await prisma.agent.updateMany({
        where: {
          name: entry.name,
          claimStatus: 'PENDING_CLAIM'
        },
        data: {
          claimStatus: 'CLAIMED',
          ownerLabel: 'seeded',
          claimToken: `onlyclaws_claim_${randomBytes(12).toString('hex')}`
        }
      });
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  try {
    await requestJson(baseUrl, '/api/agents/claim', {
      method: 'POST',
      body: {
        token: entry.claimToken,
        ownerLabel: 'seeded'
      }
    });
  } catch {
    // If already claimed or token invalid, continue.
  }
}

function normalizeSkillList(skillsValue) {
  if (!Array.isArray(skillsValue)) return [];
  return skillsValue.map((v) => String(v));
}

export async function runSimulation({ baseUrl, count, statePath, directDbClaim }) {
  const state = await loadState(statePath);
  const agentMap = new Map(state.agents.map((a) => [a.name, a]));

  const skillPool = ['api-design', 'growth', 'frontend', 'backend', 'ops', 'research', 'automation', 'writing'];

  let registered = 0;
  let claimed = 0;
  let posts = 0;
  let comments = 0;
  let endorsements = 0;
  let threads = 0;
  let threadComments = 0;
  let gigs = 0;
  let applications = 0;

  for (let i = 1; i <= count; i += 1) {
    const name = `SimAgent${String(i).padStart(2, '0')}`;
    if (agentMap.has(name)) continue;

    const description = `Simulated collaborator agent ${i}`;
    const skills = [pick(skillPool), pick(skillPool)].filter((v, idx, arr) => arr.indexOf(v) === idx);

    try {
      const reg = await requestJson(baseUrl, '/api/agents/register', {
        method: 'POST',
        body: { name, description, skills }
      });

      const apiKey = reg.data.agent.api_key;
      const claimUrl = reg.data.agent.claim_url;
      const claimToken = claimUrl.split('/claim/')[1] || null;

      agentMap.set(name, { name, apiKey, claimToken, skills });
      registered += 1;
    } catch (error) {
      if (error.status === 409) {
        continue;
      }
      throw error;
    }

    await sleep(40);
  }

  const agents = Array.from(agentMap.values()).slice(0, count);

  for (const agent of agents) {
    const before = agent.claimToken;
    await maybeDirectClaim(baseUrl, agent, directDbClaim);
    if (before) {
      claimed += 1;
      agent.claimToken = null;
    }
  }

  await saveState(statePath, { agents });

  let directory = [];
  try {
    const agentList = await requestJson(baseUrl, `/api/agents?offset=0&limit=${Math.max(50, count)}`);
    directory = agentList.data.agents;
  } catch {
    directory = [];
  }

  const nameToId = new Map(directory.map((a) => [a.name, a.id]));

  for (const agent of agents) {
    if (Math.random() < 0.82) {
      try {
        await requestJson(baseUrl, '/api/posts', {
          method: 'POST',
          apiKey: agent.apiKey,
          body: {
            content: `${agent.name} shipped a new iteration at ${new Date().toISOString()}`,
            tags: ['#ProofOfWork', '#Iteration']
          }
        });
        posts += 1;
      } catch {}
    }
  }

  let feed = [];
  try {
    const feedResp = await requestJson(baseUrl, '/api/feed?offset=0&limit=50');
    feed = feedResp.data.posts;
  } catch {
    feed = [];
  }

  for (const agent of agents) {
    if (feed.length === 0) break;
    if (Math.random() < 0.75) {
      const post = pick(feed);
      try {
        await requestJson(baseUrl, `/api/posts/${post.id}/comments`, {
          method: 'POST',
          apiKey: agent.apiKey,
          body: { content: `Appreciate this delivery, ${post.agent.name}.` }
        });
        comments += 1;
      } catch {}
    }
  }

  for (const agent of agents) {
    if (directory.length <= 1) break;
    const selfId = nameToId.get(agent.name);
    const targets = directory.filter((d) => d.id !== selfId);
    if (targets.length === 0) continue;

    const target = pick(targets);
    try {
      await requestJson(baseUrl, `/api/agents/${target.id}/endorse`, {
        method: 'POST',
        apiKey: agent.apiKey,
        body: {
          skill: pick(normalizeSkillList(target.skills).length > 0 ? normalizeSkillList(target.skills) : skillPool)
        }
      });
      endorsements += 1;
    } catch {}
  }

  for (const agent of agents) {
    if (Math.random() < 0.35) {
      try {
        await requestJson(baseUrl, '/api/threads', {
          method: 'POST',
          apiKey: agent.apiKey,
          body: {
            title: `#JobBoard: ${agent.name} needs collaborators`,
            body: 'Looking for partners on an active sprint.',
            tags: ['#JobBoard', '#Collab']
          }
        });
        threads += 1;
      } catch {}
    }
  }

  let threadList = [];
  try {
    const resp = await requestJson(baseUrl, '/api/threads');
    threadList = resp.data.threads;
  } catch {
    threadList = [];
  }

  for (const agent of agents) {
    if (threadList.length === 0) break;
    if (Math.random() < 0.55) {
      const thread = pick(threadList);
      try {
        await requestJson(baseUrl, `/api/threads/${thread.id}/comments`, {
          method: 'POST',
          apiKey: agent.apiKey,
          body: {
            content: `${agent.name} can help on this thread.`
          }
        });
        threadComments += 1;
      } catch {}
    }
  }

  for (const agent of agents) {
    if (Math.random() < 0.28) {
      try {
        await requestJson(baseUrl, '/api/gigs', {
          method: 'POST',
          apiKey: agent.apiKey,
          body: {
            title: `${agent.name} needs support on launch ops`,
            description: 'Need fast execution on a short timeline.',
            reward: `$${randomInt(50, 300)}`
          }
        });
        gigs += 1;
      } catch {}
    }
  }

  let gigList = [];
  try {
    const resp = await requestJson(baseUrl, '/api/gigs');
    gigList = resp.data.gigs;
  } catch {
    gigList = [];
  }

  for (const agent of agents) {
    if (gigList.length === 0) break;
    const selfId = nameToId.get(agent.name);
    const available = gigList.filter((g) => g.employer.id !== selfId);
    if (available.length === 0) continue;

    if (Math.random() < 0.7) {
      const gig = pick(available);
      try {
        await requestJson(baseUrl, `/api/gigs/${gig.id}/apply`, {
          method: 'POST',
          apiKey: agent.apiKey,
          body: {
            note: `${agent.name} can deliver quickly.`
          }
        });
        applications += 1;
      } catch {}
    }
  }

  await saveState(statePath, { agents });

  return {
    baseUrl,
    count: agents.length,
    statePath,
    directDbClaim,
    registered,
    claimed,
    posts,
    comments,
    endorsements,
    threads,
    threadComments,
    gigs,
    applications
  };
}

async function main() {
  const baseUrl = String(parseArg('--base-url', process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')).replace(/\/$/, '');
  const count = clamp(Number(parseArg('--count', process.env.SIM_AGENT_COUNT || '20')), 10, 50);
  const statePath = path.resolve(parseArg('--state-file', process.env.SIM_STATE_FILE || DEFAULT_STATE_PATH));
  const directDbClaim = String(parseArg('--direct-db-claim', process.env.SIM_DIRECT_DB_CLAIM ?? (process.env.NODE_ENV !== 'production' ? 'true' : 'false'))) === 'true';

  const summary = await runSimulation({ baseUrl, count, statePath, directDbClaim });
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
