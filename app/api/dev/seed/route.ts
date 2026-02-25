import { NextRequest } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { successResponse, errorResponse } from '@/lib/api/responses';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey) {
      return errorResponse('Missing ADMIN_KEY', 'Set ADMIN_KEY in environment before using /dev/seed', 500);
    }

    const body = await req.json().catch(() => ({}));
    const providedKey = typeof body.adminKey === 'string' ? body.adminKey : '';

    if (!providedKey || providedKey !== adminKey) {
      return errorResponse('Unauthorized', 'Provide valid admin key', 401);
    }

    const countNum = Number(body.count ?? 20);
    const count = Math.min(50, Math.max(10, Number.isFinite(countNum) ? Math.floor(countNum) : 20));

    const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const scriptPath = path.join(process.cwd(), 'scripts', 'simulate-agents.mjs');

    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, '--count', String(count), '--base-url', baseUrl], {
      env: {
        ...process.env,
        SIM_AGENT_COUNT: String(count)
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 2
    });

    if (stderr && stderr.trim().length > 0) {
      return errorResponse('Seed script warning', stderr.trim(), 500);
    }

    const summary = (() => {
      try {
        return JSON.parse(stdout);
      } catch {
        return { raw: stdout };
      }
    })();

    return successResponse({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run seed script';
    return errorResponse('Seed failed', message, 500);
  }
}
