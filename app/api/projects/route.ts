import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const tenant = body?.tenantSlug
    ? await prisma.tenant.findUnique({
        where: { slug: body.tenantSlug },
        include: {
          applications: {
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : await prisma.tenant.findFirst({
        include: {
          applications: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

  if (!tenant || tenant.applications.length === 0) {
    return NextResponse.json({ error: "未找到可用租户或应用空间。" }, { status: 400 });
  }

  if (!body?.name || !body?.goal || !body?.ownerName) {
    return NextResponse.json({ error: "缺少必要字段 name / goal / ownerName。" }, { status: 400 });
  }

  const application =
    tenant.applications.find((item) => item.id === body.applicationId) ?? tenant.applications[0];

  const project = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      applicationId: application.id,
      projectCode: body.projectCode ?? `P-${Date.now().toString().slice(-8)}`,
      name: body.name,
      goal: body.goal,
      ownerName: body.ownerName,
      focusArea: body.focusArea ?? body.focusFeature ?? "自定义研究主题",
      focusTarget: body.focusTarget ?? "未指定研究对象",
      focusFeature: body.focusFeature ?? "自定义研究主题",
      description: body.description ?? body.goal,
      filterTimeRangeLabel: body.filterTimeRangeLabel ?? "手工创建",
      filterPageTemplates: body.filterPageTemplates ?? "",
      filterStatuses: body.filterStatuses ?? "",
      filterTagRules: body.filterTagRules ?? "",
    },
  });

  revalidatePath("/projects");
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${tenant.slug}/projects`);
  return NextResponse.json({ project }, { status: 201 });
}
