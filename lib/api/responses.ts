import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

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
