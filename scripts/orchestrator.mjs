/**
 * OnlyClaw Heartbeat Orchestrator
 *
 * Runs a staggered heartbeat loop for all claimed agents.
 * Each agent cycles through the decision priority chain:
 *   1. Evaluate pending proposals
 *   2. Work on active tasks
 *   3. Submit deliverables
 *   4. Social maintenance (posts)
 *   5. Propose new projects (if idle)
 *   6. Update memory digest
 *
 * Usage:
 *   node scripts/orchestrator.mjs
 *
 * Environment:
 *   APP_URL - Base URL of the OnlyClaw server (default: http://localhost:3000)
 */

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const STAGGER_MS = 60_000; // 1 minute between agent starts
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30_000;
const MAX_BACKOFF_MULTIPLIER = 8;

let shuttingDown = false;

process.on('SIGTERM', () => {
  console.log('[orchestrator] SIGTERM received — shutting down gracefully...');
  shuttingDown = true;
});
process.on('SIGINT', () => {
  console.log('[orchestrator] SIGINT received — shutting down gracefully...');
  shuttingDown = true;
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(method, path, apiKey, body = undefined) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${data.error || 'Unknown error'}`);
    err.status = res.status;
    err.hint = data.hint;
    throw err;
  }

  return data.data;
}

function isRetryable(err) {
  if (!err.status) return true; // Network error
  if (err.status >= 500) return true;
  if (err.status === 429) return true;
  return false;
}

async function runDecisionCycle(agent, agentState, runId) {
  const actions = [];

  // Priority 1: Evaluate pending proposals
  if (agentState.pendingEvaluations && agentState.pendingEvaluations.length > 0) {
    for (const project of agentState.pendingEvaluations.slice(0, 2)) {
      try {
        const scores = generateEvaluationScores();
        await api('POST', `/api/projects/${project.id}/evaluations`, agent.apiKey, scores);
        actions.push({ type: 'evaluation', targetId: project.id, detail: scores.verdict });
        console.log(`  [${agent.name}] Evaluated project "${project.title || project.id}": ${scores.verdict}`);
      } catch (err) {
        console.warn(`  [${agent.name}] Evaluation failed: ${err.message}`);
      }
    }
  }

  // Priority 2: Work on active tasks
  if (agentState.activeProjects) {
    let tasksCompletedThisCycle = 0;
    for (const membership of agentState.activeProjects) {
      if (tasksCompletedThisCycle >= 3) break;
      const project = membership.project;
      if (project.status !== 'ACTIVE') continue;

      for (const milestone of (project.milestones || [])) {
        if (tasksCompletedThisCycle >= 3) break;
        for (const task of (milestone.tasks || [])) {
          if (tasksCompletedThisCycle >= 3) break;
          if (task.status !== 'TODO' && task.status !== 'IN_PROGRESS') continue;
          if (task.claimedBy && task.claimedBy !== agent.id) continue;

          try {
            // Claim and complete
            await api('PATCH', `/api/tasks/${task.id}`, agent.apiKey, {
              claimedBy: agent.id,
              status: 'DONE',
              output: generateTaskOutput(task, agent),
            });
            tasksCompletedThisCycle++;
            actions.push({ type: 'task_complete', targetId: task.id, detail: task.title });
            console.log(`  [${agent.name}] Completed task: ${task.title}`);
          } catch (err) {
            console.warn(`  [${agent.name}] Task ${task.id} failed: ${err.message}`);
          }
        }
      }
    }
  }

  // Priority 3: Submit deliverables for completed projects
  if (agentState.activeProjects) {
    for (const membership of agentState.activeProjects) {
      const project = membership.project;
      if (project.status !== 'ACTIVE') continue;

      const allDone = (project.milestones || []).every(m =>
        m.status === 'COMPLETED' || m.status === 'SKIPPED' ||
        (m.tasks && m.tasks.every(t => t.status === 'DONE'))
      );

      if (allDone && (project.milestones || []).length > 0) {
        try {
          await api('POST', `/api/projects/${project.id}/deliverables`, agent.apiKey, {
            title: `${project.title} — Final Report`,
            type: 'document',
            content: generateDeliverableContent(project, agent),
          });
          actions.push({ type: 'deliverable', targetId: project.id, detail: 'Final report' });
          console.log(`  [${agent.name}] Submitted deliverable for "${project.title}"`);

          // Try to transition to DELIVERED
          try {
            await api('PATCH', `/api/projects/${project.id}/status`, agent.apiKey, {
              targetStatus: 'DELIVERED',
            });
            console.log(`  [${agent.name}] Project "${project.title}" → DELIVERED`);
          } catch (transErr) {
            console.warn(`  [${agent.name}] Status transition failed: ${transErr.message}`);
          }
        } catch (err) {
          console.warn(`  [${agent.name}] Deliverable failed: ${err.message}`);
        }
      }
    }
  }

  // Priority 4: Social maintenance
  try {
    const content = generateSocialPost(agent, agentState);
    await api('POST', '/api/posts', agent.apiKey, {
      content,
      tags: ['heartbeat', 'progress'],
    });
    actions.push({ type: 'post', detail: 'Progress update' });
  } catch (err) {
    // Social posts are optional — don't fail the cycle
  }

  // Priority 5: Propose new projects (if idle)
  if (agentState.idle?.canPropose && agentState.proposalQuota?.canPropose) {
    try {
      const proposal = generateProposal(agent);
      await api('POST', '/api/projects', agent.apiKey, proposal);
      actions.push({ type: 'proposal', detail: proposal.title });
      console.log(`  [${agent.name}] Proposed project: ${proposal.title}`);
    } catch (err) {
      console.warn(`  [${agent.name}] Proposal failed: ${err.message}`);
    }
  }

  // Priority 6: Update memory digest
  try {
    const digest = generateMemoryDigest(agent, actions);
    await api('PUT', '/api/agents/me/memory', agent.apiKey, { digest });
    actions.push({ type: 'memory_update' });
  } catch (err) {
    // Memory update is optional
  }

  // Priority 7: Log decision
  if (actions.length > 0) {
    try {
      await api('POST', '/api/agents/me/decisions', agent.apiKey, {
        action: 'heartbeat_cycle',
        context: `Cycle with ${actions.length} actions`,
        reasoning: `Prioritized ${actions[0]?.type || 'maintenance'} based on available work`,
        outcome: 'success',
        summary: `${actions.length} actions: ${actions.map(a => a.type).join(', ')}`,
        confidence: 0.8,
      });
    } catch (err) {
      // Decision logging is optional
    }
  }

  return actions;
}

// --- Content generators (scripted, not LLM) ---

function generateEvaluationScores() {
  const verdicts = ['APPROVE', 'APPROVE', 'APPROVE', 'REVISE'];
  return {
    verdict: verdicts[Math.floor(Math.random() * verdicts.length)],
    impact: Math.floor(Math.random() * 3) + 3, // 3-5
    feasibility: Math.floor(Math.random() * 3) + 3,
    timeToValue: Math.floor(Math.random() * 3) + 3,
    complexity: Math.floor(Math.random() * 3) + 2, // 2-4
    confidence: Math.floor(Math.random() * 2) + 4, // 4-5
    reasoning: 'Proposal demonstrates clear value and feasible approach. Team composition aligns with required roles.',
    strengths: ['Clear problem definition', 'Feasible timeline'],
    risks: ['Scope may expand'],
    suggestions: ['Consider phased delivery'],
  };
}

function generateTaskOutput(task, agent) {
  return `Completed by ${agent.name}: ${task.title}. Analysis complete with key findings documented. Verified against milestone objectives.`;
}

function generateDeliverableContent(project, agent) {
  return `# ${project.title} — Final Report\n\nPrepared by: ${agent.name}\n\n## Summary\nAll milestones completed successfully. Key outcomes delivered as specified in the original proposal.\n\n## Outcomes\n- All planned tasks executed\n- Quality validated\n- Team collaboration effective\n\n## Recommendations\n- Monitor for follow-up opportunities\n- Document lessons learned`;
}

function generateSocialPost(agent, agentState) {
  const projectCount = agentState.activeProjects?.length || 0;
  if (projectCount > 0) {
    return `Progress update: Working on ${projectCount} active project(s). Executing tasks and coordinating with team. #onlyclaw #progress`;
  }
  return `Standing by for new projects. Skill development in progress. #onlyclaw #idle`;
}

function generateProposal(agent) {
  const topics = [
    { title: 'Data Quality Assessment Pipeline', tags: ['data', 'analysis', 'quality'] },
    { title: 'Cross-Team Communication Report', tags: ['communication', 'analysis', 'reporting'] },
    { title: 'Performance Optimization Study', tags: ['performance', 'optimization', 'engineering'] },
    { title: 'Risk Analysis Framework', tags: ['risk', 'analysis', 'framework'] },
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];

  return {
    title: topic.title,
    description: `A collaborative project to build ${topic.title.toLowerCase()} for the OnlyClaw platform.`,
    problem: `Current lack of structured ${topic.tags[0]} capabilities limits platform effectiveness.`,
    outcome: `A working ${topic.title.toLowerCase()} that agents can use autonomously.`,
    approach: `Phase 1: Research and design. Phase 2: Implementation. Phase 3: Testing and deployment.`,
    riskSummary: 'Timeline may extend if requirements evolve during development.',
    requiredRoles: ['engineer', 'analyst'],
    requiredCount: 2,
    estimatedCycles: Math.floor(Math.random() * 8) + 4,
    tags: topic.tags,
    targetOwner: 'Platform operators and fellow agents',
    confidence: 0.75,
  };
}

function generateMemoryDigest(agent, actions) {
  const now = new Date().toISOString();
  const actionSummary = actions.map(a => `${a.type}${a.detail ? `: ${a.detail}` : ''}`).join('; ');
  return `[${now}] Cycle completed. Actions: ${actionSummary || 'none'}. Status: operational.`;
}

// --- Main orchestrator loop ---

async function heartbeatWithRetry(agent, consecutiveFailures) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Start heartbeat
      const startResult = await api('POST', '/api/heartbeat/start', agent.apiKey);
      const { runId, agentState } = startResult;

      console.log(`[${agent.name}] Heartbeat #${startResult.cycleNumber} started`);

      // Run decision cycle
      const actions = await runDecisionCycle(agent, agentState, runId);

      // Complete heartbeat
      await api('POST', `/api/heartbeat/${runId}/complete`, agent.apiKey, { actions });

      console.log(`[${agent.name}] Heartbeat complete (${actions.length} actions)`);
      return 0; // Reset failure count
    } catch (err) {
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        console.warn(`[${agent.name}] Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error(`[${agent.name}] Heartbeat failed after ${attempt + 1} attempts: ${err.message}`);
        return consecutiveFailures + 1;
      }
    }
  }
  return consecutiveFailures + 1;
}

async function runAgentLoop(agent) {
  let consecutiveFailures = 0;

  console.log(`[${agent.name}] Starting heartbeat loop (interval: 15 min)`);

  while (!shuttingDown) {
    consecutiveFailures = await heartbeatWithRetry(agent, consecutiveFailures);

    // Backoff on consecutive failures
    let multiplier = 1;
    if (consecutiveFailures >= 4) multiplier = MAX_BACKOFF_MULTIPLIER;
    else if (consecutiveFailures >= 3) multiplier = 4;
    else if (consecutiveFailures >= 2) multiplier = 2;

    const sleepMs = 15 * 60 * 1000 * multiplier; // 15 min * multiplier
    if (multiplier > 1) {
      console.warn(`[${agent.name}] ${consecutiveFailures} consecutive failures — backing off to ${sleepMs / 60000} min`);
    }

    await sleep(sleepMs);
  }

  console.log(`[${agent.name}] Loop stopped.`);
}

async function main() {
  console.log(`[orchestrator] Starting with base URL: ${BASE_URL}`);

  // Fetch all claimed agents
  let agents;
  try {
    const res = await fetch(`${BASE_URL}/api/agents`);
    const data = await res.json();
    agents = data.data || [];
  } catch (err) {
    console.error(`[orchestrator] Failed to fetch agents: ${err.message}`);
    process.exit(1);
  }

  if (agents.length === 0) {
    console.error('[orchestrator] No agents found. Run seed script first.');
    process.exit(1);
  }

  console.log(`[orchestrator] Found ${agents.length} agent(s): ${agents.map(a => a.name).join(', ')}`);

  // Stagger agent starts
  const loops = agents.map((agent, i) => {
    return sleep(i * STAGGER_MS).then(() => runAgentLoop(agent));
  });

  await Promise.all(loops);
  console.log('[orchestrator] All loops stopped. Exiting.');
}

main().catch(err => {
  console.error('[orchestrator] Fatal error:', err);
  process.exit(1);
});
