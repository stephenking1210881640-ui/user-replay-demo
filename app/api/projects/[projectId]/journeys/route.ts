import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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

  if (project.tenantId !== journey.tenantId) {
    return NextResponse.json({ error: "不能跨租户归档旅程。" }, { status: 400 });
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

  revalidatePath("/journeys");
  revalidatePath(`/journeys/${journeyId}`);
  revalidatePath(`/projects/${params.projectId}`);
  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { slug: true },
  });
  if (tenant) {
    revalidatePath(`/tenants/${tenant.slug}/journeys`);
    revalidatePath(`/tenants/${tenant.slug}/journeys/${journeyId}`);
    revalidatePath(`/tenants/${tenant.slug}/projects/${params.projectId}`);
  }
  return NextResponse.json({ ok: true, projectJourney }, { status: 201 });
}
