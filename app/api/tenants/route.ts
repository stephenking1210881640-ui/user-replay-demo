import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { TenantPlan, TenantStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.name || !body?.slug || !body?.industry) {
    return NextResponse.json({ error: "缺少必要字段 name / slug / industry。" }, { status: 400 });
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug: body.slug.trim() },
  });

  if (existing) {
    return NextResponse.json({ error: "该 slug 已存在。" }, { status: 409 });
  }

  const plan = Object.values(TenantPlan).includes(body.plan) ? body.plan : TenantPlan.STARTER;
  const status = Object.values(TenantStatus).includes(body.status) ? body.status : TenantStatus.TRIAL;

  const tenant = await prisma.tenant.create({
    data: {
      name: body.name.trim(),
      slug: body.slug.trim(),
      industry: body.industry.trim(),
      plan,
      status,
      description: body.description?.trim() || null,
      applications: {
        create: {
          name: `${body.name.trim()} Primary App`,
          appKey: `${body.slug.trim().replace(/[^a-z0-9-]/gi, "_")}_primary_app`,
          host: `${body.slug.trim()}.demo.local`,
          description: "新创建租户自动初始化的默认应用空间。",
        },
      },
    },
  });

  revalidatePath("/tenants");
  return NextResponse.json({ tenant }, { status: 201 });
}
