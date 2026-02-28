import { Evaluation, Milestone, MilestoneStatus, Task, TaskStatus } from '@prisma/client';

interface PriorityResult {
  score: number;
  label: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
}

export function computePriorityScore(evaluations: Evaluation[]): PriorityResult {
  if (evaluations.length === 0) {
    return { score: 0, label: 'VERY_LOW' };
  }

  let totalImpact = 0;
  let totalFeasibility = 0;
  let totalTimeToValue = 0;
  let totalComplexity = 0;
  let totalConfidence = 0;

  for (const e of evaluations) {
    totalImpact += e.impact;
    totalFeasibility += e.feasibility;
    totalTimeToValue += e.timeToValue;
    totalComplexity += e.complexity;
    totalConfidence += e.confidence;
  }

  const n = evaluations.length;
  const avgImpact = totalImpact / n;
  const avgFeasibility = totalFeasibility / n;
  const avgTimeToValue = totalTimeToValue / n;
  const avgComplexity = totalComplexity / n;
  const avgConfidence = totalConfidence / n;

  // Weighted formula: impact(0.30) + feasibility(0.25) + timeToValue(0.25) + invertedComplexity(0.20)
  // Confidence acts as multiplier
  const invertedComplexity = 6 - avgComplexity; // 5=simple→1, 1=complex→5
  const raw = 0.30 * avgImpact + 0.25 * avgFeasibility + 0.25 * avgTimeToValue + 0.20 * invertedComplexity;
  const confidenceMultiplier = 0.5 + (avgConfidence - 1) / 8;
  const score = Math.max(0, Math.min(1, (raw / 5) * confidenceMultiplier));

  let label: PriorityResult['label'];
  if (score >= 0.7) label = 'HIGH';
  else if (score >= 0.5) label = 'MEDIUM';
  else if (score >= 0.3) label = 'LOW';
  else label = 'VERY_LOW';

  return { score: Math.round(score * 100) / 100, label };
}

export function computeConsensusLevel(evaluations: Evaluation[]): number {
  if (evaluations.length === 0) return 0;

  const approveCount = evaluations.filter(e => e.verdict === 'APPROVE').length;
  const rejectCount = evaluations.filter(e => e.verdict === 'REJECT').length;

  return (approveCount - rejectCount) / evaluations.length;
}

interface HealthResult {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
}

export function computeProjectHealth(
  milestones: (Milestone & { tasks: Task[] })[]
): HealthResult {
  const issues: string[] = [];
  const allTasks = milestones.flatMap(m => m.tasks);
  const totalTasks = allTasks.length;

  if (totalTasks === 0) {
    return { status: 'warning', issues: ['No tasks defined'] };
  }

  const blockedTasks = allTasks.filter(t => t.status === TaskStatus.BLOCKED).length;
  const completedTasks = allTasks.filter(t => t.status === TaskStatus.DONE).length;

  const blockedRatio = blockedTasks / totalTasks;
  const completionRatio = completedTasks / totalTasks;

  if (blockedRatio > 0.5) {
    issues.push(`${blockedTasks}/${totalTasks} tasks blocked`);
  }
  if (blockedRatio > 0.3) {
    issues.push(`High block rate: ${Math.round(blockedRatio * 100)}%`);
  }

  // Check for stalled milestones (IN_PROGRESS with no recent task completion)
  const stalledMilestones = milestones.filter(
    m => m.status === MilestoneStatus.IN_PROGRESS &&
      m.tasks.every(t => t.status !== TaskStatus.DONE)
  );
  if (stalledMilestones.length > 0) {
    issues.push(`${stalledMilestones.length} stalled milestone(s)`);
  }

  let status: HealthResult['status'];
  if (blockedRatio > 0.5 || stalledMilestones.length > 1) {
    status = 'critical';
  } else if (blockedRatio > 0.2 || stalledMilestones.length > 0 || completionRatio < 0.1) {
    status = 'warning';
  } else {
    status = 'healthy';
  }

  return { status, issues };
}

interface ProgressResult {
  percentage: number;
  completedTasks: number;
  totalTasks: number;
  velocity: number;
  estimatedCyclesRemaining: number;
}

export function computeProgress(
  milestones: (Milestone & { tasks: Task[] })[]
): ProgressResult {
  const allTasks = milestones.flatMap(m => m.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === TaskStatus.DONE).length;

  const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Compute velocity from recent completions (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCompletions = allTasks.filter(
    t => t.status === TaskStatus.DONE && t.completedAt && t.completedAt > oneDayAgo
  ).length;

  const velocity = recentCompletions > 0 ? recentCompletions : 0.5;
  const remaining = totalTasks - completedTasks;
  const estimatedCyclesRemaining = remaining > 0 ? Math.ceil(remaining / velocity) : 0;

  return { percentage, completedTasks, totalTasks, velocity, estimatedCyclesRemaining };
}
