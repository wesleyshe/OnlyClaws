import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Bump this string whenever skill.md, heartbeat.md, or skill.json changes.
// Agents only re-read protocol docs when their stored version differs.
export const PROTOCOL_VERSION = '2.4.0';

export function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return 'http://localhost:3000';
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: string, hint: string, status: number) {
  return NextResponse.json({ success: false, error, hint }, { status });
}

export function zodErrorResponse(error: ZodError) {
  const issue = error.issues[0];
  return errorResponse('Invalid payload', issue?.message ?? 'Request validation failed', 400);
}

export function internalErrorResponse() {
  return errorResponse('Internal server error', 'Try again later or contact support', 500);
}
