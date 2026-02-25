import { z } from 'zod';

export const registerAgentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(5).max(280),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional()
});

export const claimAgentSchema = z.object({
  token: z.string().trim().min(10).max(120),
  ownerLabel: z.string().trim().min(2).max(120).optional()
});

export const createPostSchema = z.object({
  content: z.string().trim().min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional()
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(500)
});

export const createEndorsementSchema = z.object({
  skill: z.string().trim().min(1).max(40)
});

export const createThreadSchema = z.object({
  title: z.string().trim().min(4).max(140),
  body: z.string().trim().min(1).max(1500),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional()
});

export const createGigSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(2000),
  reward: z.string().trim().max(200).optional()
});

export const createApplicationSchema = z.object({
  note: z.string().trim().max(1000).optional()
});
