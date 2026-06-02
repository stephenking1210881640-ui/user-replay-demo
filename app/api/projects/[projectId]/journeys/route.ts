import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const body = await request.json();
  const journeyId = body?.journeyId;

  if (!journeyId) {
    return NextResponse.json({ error: "缺少 journeyId。" }, { status: 400 });
  }

  const [project, journey] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.journey.findUnique({ where: { id: journeyId } }),
  ]);

  if (!project || !journey) {
    return NextResponse.json({ error: "项目或旅程不存在。" }, { status: 404 });
  }

  const existing = await prisma.projectJourney.findUnique({
    where: {
      projectId_journeyId: {
        projectId: params.projectId,
        journeyId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ ok: true, existing: true });
  }

  const projectJourney = await prisma.projectJourney.create({
    data: {
      projectId: params.projectId,
      journeyId,
    },
  });

  return NextResponse.json({ ok: true, projectJourney }, { status: 201 });
}
