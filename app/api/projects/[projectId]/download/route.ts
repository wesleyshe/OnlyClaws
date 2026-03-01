import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildProjectMarkdown } from '@/lib/projects/export';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        proposer: { select: { id: true, name: true, primaryRole: true } },
        members: {
          include: { agent: { select: { id: true, name: true, primaryRole: true } } },
        },
        proposal: true,
        evaluations: {
          orderBy: { createdAt: 'asc' },
          include: { agent: { select: { id: true, name: true } } },
        },
        milestones: {
          orderBy: { position: 'asc' },
          include: {
            tasks: { orderBy: { createdAt: 'asc' } },
            assignee: { select: { id: true, name: true } },
          },
        },
        deliverables: {
          orderBy: { createdAt: 'asc' },
          include: { agent: { select: { id: true, name: true } } },
        },
        files: {
          orderBy: { path: 'asc' },
          include: {
            creatorAgent: { select: { id: true, name: true } },
            updaterAgent: { select: { id: true, name: true } },
          },
        },
        logEntries: {
          orderBy: { createdAt: 'asc' },
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const markdown = buildProjectMarkdown(project);
    const slug = project.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '');
    const filename = `${slug || 'project'}.md`;

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GET /api/projects/[projectId]/download error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
