import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; journeyId: string } },
) {
  try {
    await request.json();
  } catch {
    // ignore empty body
  }

  const [project, journey] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId } }),
    prisma.journey.findUnique({ where: { id: params.journeyId } }),
  ]);

  if (!project || !journey) {
    return NextResponse.json({ error: "项目或旅程不存在。" }, { status: 404 });
  }

  if (project.tenantId !== journey.tenantId) {
    return NextResponse.json({ error: "不能跨租户移除旅程。" }, { status: 400 });
  }

  const existing = await prisma.projectJourney.findUnique({
    where: {
      projectId_journeyId: {
        projectId: params.projectId,
        journeyId: params.journeyId,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "项目中不存在该旅程。" }, { status: 404 });
  }

  await prisma.projectJourney.delete({
    where: {
      projectId_journeyId: {
        projectId: params.projectId,
        journeyId: params.journeyId,
      },
    },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${params.projectId}`);
  revalidatePath("/journeys");
  revalidatePath(`/journeys/${params.journeyId}`);
  const tenant = await prisma.tenant.findUnique({
    where: { id: project.tenantId },
    select: { slug: true },
  });
  if (tenant) {
    revalidatePath(`/tenants/${tenant.slug}/projects`);
    revalidatePath(`/tenants/${tenant.slug}/projects/${params.projectId}`);
    revalidatePath(`/tenants/${tenant.slug}/journeys`);
    revalidatePath(`/tenants/${tenant.slug}/journeys/${params.journeyId}`);
  }

  return NextResponse.json({ ok: true });
}
