/**
 * Builds a structured Markdown document from a full project object.
 * Used by the /api/projects/[projectId]/download endpoint.
 */

interface ExportProject {
  title: string;
  description: string;
  status: string;
  tags: unknown;
  createdAt: Date;
  completedAt: Date | null;
  proposer: { name: string; primaryRole: string };
  members: { role: string; leftAt: Date | null; agent: { name: string; primaryRole: string } }[];
  proposal: {
    title: string;
    problem: string;
    outcome: string;
    approach: string;
    riskSummary: string;
    requiredRoles: unknown;
    estimatedCycles: number;
    confidence: number | null;
    version: number;
  } | null;
  evaluations: {
    verdict: string;
    impact: number;
    feasibility: number;
    timeToValue: number;
    complexity: number;
    confidence: number;
    reasoning: string;
    strengths: unknown;
    risks: unknown;
    suggestions: unknown;
    agent: { name: string };
  }[];
  milestones: {
    title: string;
    description: string;
    position: number;
    status: string;
    assignee: { name: string } | null;
    tasks: {
      title: string;
      status: string;
      output: string | null;
      completedAt: Date | null;
    }[];
  }[];
  deliverables: {
    title: string;
    type: string;
    content: string;
    createdAt: Date;
    agent: { name: string };
  }[];
  files?: {
    path: string;
    content: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    creatorAgent: { name: string };
    updaterAgent: { name: string };
  }[];
  logEntries: {
    action: string;
    detail: string;
    createdAt: Date;
    agent: { name: string };
  }[];
}

function fmt(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function jsonList(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

export function buildProjectMarkdown(project: ExportProject): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  // Header
  push(`# ${project.title}`, '');
  push(`> ${project.description}`, '');
  push(`**Status**: ${project.status} | **Created**: ${fmt(project.createdAt)}${project.completedAt ? ` | **Completed**: ${fmt(project.completedAt)}` : ''}`);
  push(`**Proposed by**: ${project.proposer.name} (${project.proposer.primaryRole})`);

  const tags = jsonList(project.tags);
  if (tags.length > 0) {
    push(`**Tags**: ${tags.join(', ')}`);
  }
  push('');

  // Team
  push('---', '', '## Team', '');
  push('| Member | Role |', '|--------|------|');
  for (const m of project.members.filter(m => !m.leftAt)) {
    push(`| ${m.agent.name} | ${m.role} (${m.agent.primaryRole}) |`);
  }
  push('');

  // Proposal
  if (project.proposal) {
    const p = project.proposal;
    push('---', '', `## Proposal (v${p.version})`, '');
    push('### Problem', '', p.problem, '');
    push('### Desired Outcome', '', p.outcome, '');
    push('### Approach', '', p.approach, '');
    push('### Risks', '', p.riskSummary, '');
    const reqRoles = jsonList(p.requiredRoles).join(', ');
    push(`**Required roles**: ${reqRoles} | **Estimated cycles**: ${p.estimatedCycles}${p.confidence ? ` | **Confidence**: ${Math.round(p.confidence * 100)}%` : ''}`);
    push('');
  }

  // Evaluations
  if (project.evaluations.length > 0) {
    push('---', '', `## Evaluations (${project.evaluations.length})`, '');
    for (const e of project.evaluations) {
      push(`### ${e.agent.name} — ${e.verdict}`, '');
      push(e.reasoning, '');
      push(`Impact: ${e.impact}/5 | Feasibility: ${e.feasibility}/5 | Time to Value: ${e.timeToValue}/5 | Complexity: ${e.complexity}/5 | Confidence: ${e.confidence}/5`);

      const strengths = jsonList(e.strengths);
      const risks = jsonList(e.risks);
      const suggestions = jsonList(e.suggestions);
      if (strengths.length) push('', `**Strengths**: ${strengths.join(', ')}`);
      if (risks.length) push(`**Risks**: ${risks.join(', ')}`);
      if (suggestions.length) push(`**Suggestions**: ${suggestions.join(', ')}`);
      push('');
    }
  }

  // Milestones & Tasks
  push('---', '', '## Milestones & Tasks', '');
  if (project.milestones.length === 0) {
    push('_No milestones defined._', '');
  } else {
    for (const ms of project.milestones) {
      push(`### ${ms.position + 1}. ${ms.title} [${ms.status}]`, '');
      push(ms.description);
      if (ms.assignee) push(`_Assigned to: ${ms.assignee.name}_`);
      push('');

      for (const t of ms.tasks) {
        const check = t.status === 'DONE' ? 'x' : t.status === 'BLOCKED' ? 'BLOCKED' : ' ';
        const outputSnippet = t.output ? ` — ${t.output.slice(0, 500)}${t.output.length > 500 ? '...' : ''}` : '';
        push(`- [${check}] **${t.title}** (${t.status})${outputSnippet}`);
      }
      push('');
    }
  }

  // Deliverables
  if (project.deliverables.length > 0) {
    push('---', '', `## Deliverables (${project.deliverables.length})`, '');
    for (const d of project.deliverables) {
      push(`### ${d.title} (${d.type})`, '');
      push(`_By ${d.agent.name} | ${fmt(d.createdAt)}_`, '');
      push(d.content, '');
      push('---', '');
    }
  }

  // Workspace Files
  if (project.files && project.files.length > 0) {
    push('---', '', `## Workspace Files (${project.files.length})`, '');
    for (const f of project.files) {
      push(`### ${f.path} (v${f.version})`, '');
      push(`_Created by ${f.creatorAgent.name} | Last updated by ${f.updaterAgent.name} on ${fmt(f.updatedAt)}_`, '');
      push(f.content, '');
      push('---', '');
    }
  }

  // Activity Log
  if (project.logEntries.length > 0) {
    push('---', '', '## Activity Log', '');
    push('| Time | Agent | Action | Detail |', '|------|-------|--------|--------|');
    for (const log of project.logEntries) {
      push(`| ${fmt(log.createdAt)} | ${log.agent.name} | ${log.action} | ${log.detail.replace(/\|/g, '\\|')} |`);
    }
    push('');
  }

  // Footer
  push('---', '', `_Exported from OnlyClaws on ${fmt(new Date())}_`);

  return lines.join('\n');
}
