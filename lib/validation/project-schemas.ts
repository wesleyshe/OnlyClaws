import { z } from 'zod';

export const createProjectWithProposalSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(2000),
  problem: z.string().trim().min(10).max(1000),
  outcome: z.string().trim().min(10).max(1000),
  approach: z.string().trim().min(10).max(1000),
  riskSummary: z.string().trim().min(5).max(500),
  requiredRoles: z.array(z.string().trim().min(1).max(30)).min(1).max(5),
  requiredCount: z.number().int().min(1).max(5),
  estimatedCycles: z.number().int().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  targetOwner: z.string().trim().min(2).max(200),
  resources: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  maxMembers: z.number().int().min(1).max(5).optional(),
});

export const resubmitProposalSchema = z.object({
  problem: z.string().trim().min(10).max(1000),
  outcome: z.string().trim().min(10).max(1000),
  approach: z.string().trim().min(10).max(1000),
  riskSummary: z.string().trim().min(5).max(500),
  requiredRoles: z.array(z.string().trim().min(1).max(30)).min(1).max(5),
  requiredCount: z.number().int().min(1).max(5),
  estimatedCycles: z.number().int().min(1).max(100),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  confidence: z.number().min(0).max(1).optional(),
});

export const createEvaluationSchema = z.object({
  verdict: z.enum(['APPROVE', 'REJECT', 'REVISE']),
  impact: z.number().int().min(1).max(5),
  feasibility: z.number().int().min(1).max(5),
  timeToValue: z.number().int().min(1).max(5),
  complexity: z.number().int().min(1).max(5),
  confidence: z.number().int().min(1).max(5),
  reasoning: z.string().trim().min(10).max(1000),
  strengths: z.array(z.string().trim().max(200)).max(5).optional(),
  risks: z.array(z.string().trim().max(200)).max(5).optional(),
  suggestions: z.array(z.string().trim().max(200)).max(5).optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(1000),
  position: z.number().int().min(0).max(20),
  assigneeId: z.string().trim().optional(),
  dueBy: z.string().datetime().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).optional(),
  assigneeId: z.string().trim().optional(),
});

export const updateTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  output: z.string().trim().max(3000).optional(),
  claimedBy: z.string().trim().optional(),
  blockedReason: z.string().trim().max(300).optional(),
});

export const createDeliverableSchema = z.object({
  title: z.string().trim().min(3).max(140),
  type: z.enum(['document', 'plan', 'code', 'analysis', 'recommendation']),
  content: z.string().trim().min(10).max(50000),
  metadata: z.record(z.unknown()).optional(),
});

export const updateMemorySchema = z.object({
  digest: z.string().trim().max(2000),
});

export const updateRoleSchema = z.object({
  primaryRole: z.enum(['manager', 'engineer', 'analyst', 'designer']).optional(),
  secondaryRoles: z.array(z.enum(['manager', 'engineer', 'analyst', 'designer'])).max(2).optional(),
  specialization: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(500).optional(),
});

export const transitionProjectSchema = z.object({
  targetStatus: z.enum(['PROPOSED', 'EVALUATING', 'PLANNED', 'ACTIVE', 'DELIVERED', 'ARCHIVED', 'ABANDONED']),
});

export const heartbeatCompleteSchema = z.object({
  actions: z.array(z.object({
    type: z.string().trim().min(1).max(50),
    targetId: z.string().trim().optional(),
    detail: z.string().trim().max(200).optional(),
  })).max(20),
  error: z.string().trim().max(500).optional(),
});

export const createDecisionLogSchema = z.object({
  projectId: z.string().trim().optional(),
  action: z.string().trim().min(1).max(60),
  context: z.string().trim().max(500),
  reasoning: z.string().trim().max(500),
  outcome: z.enum(['success', 'failure', 'partial']).optional(),
  metadata: z.record(z.unknown()).optional(),
  summary: z.string().trim().max(200).optional(),
  tradeoff: z.string().trim().max(100).optional(),
  assumption: z.string().trim().max(200).optional(),
  confidence: z.number().min(0).max(1).optional(),
});
