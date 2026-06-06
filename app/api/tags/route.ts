import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { TagSource, TagType } from "@prisma/client";

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

  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: "缺少必要字段 name / type。" }, { status: 400 });
  }

  if (!Object.values(TagType).includes(body.type)) {
    return NextResponse.json({ error: "无效的标签类型。" }, { status: 400 });
  }

  const source = Object.values(TagSource).includes(body.source) ? body.source : TagSource.MANUAL;
  const application =
    tenant.applications.find((item) => item.id === body.applicationId) ?? tenant.applications[0];

  const tag = await prisma.tag.create({
    data: {
      tenantId: tenant.id,
      applicationId: application.id,
      name: body.name.trim(),
      type: body.type,
      source,
      color: body.color?.trim() || "#e2e8f0",
      description: body.description?.trim() || null,
    },
  });

  revalidatePath("/tags");
  revalidatePath("/users");
  revalidatePath("/journeys");
  revalidatePath(`/tenants/${tenant.slug}/tags`);
  revalidatePath(`/tenants/${tenant.slug}/users`);
  revalidatePath(`/tenants/${tenant.slug}/journeys`);

  return NextResponse.json({ tag }, { status: 201 });
}
