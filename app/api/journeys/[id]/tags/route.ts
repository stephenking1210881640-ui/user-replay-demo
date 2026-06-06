import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { TagType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const tagId = body?.tagId;

  if (!tagId) {
    return NextResponse.json({ error: "缺少 tagId。" }, { status: 400 });
  }

  const [journey, tag] = await Promise.all([
    prisma.journey.findUnique({ where: { id: params.id } }),
    prisma.tag.findUnique({ where: { id: tagId } }),
  ]);

  if (!journey || !tag) {
    return NextResponse.json({ error: "旅程或标签不存在。" }, { status: 404 });
  }

  if (journey.tenantId !== tag.tenantId) {
    return NextResponse.json({ error: "不能跨租户添加标签。" }, { status: 400 });
  }

  if (tag.type !== TagType.JOURNEY) {
    return NextResponse.json({ error: "该标签不是旅程标签。" }, { status: 400 });
  }

  const existing = await prisma.journeyTag.findUnique({
    where: {
      journeyId_tagId: {
        journeyId: params.id,
        tagId,
      },
    },
  });

  if (!existing) {
    await prisma.journeyTag.create({
      data: {
        journeyId: params.id,
        tagId,
      },
    });
  }

  revalidatePath("/journeys");
  revalidatePath(`/journeys/${params.id}`);
  revalidatePath("/tags");
  const tenant = await prisma.tenant.findUnique({
    where: { id: journey.tenantId },
    select: { slug: true },
  });
  if (tenant) {
    revalidatePath(`/tenants/${tenant.slug}/journeys`);
    revalidatePath(`/tenants/${tenant.slug}/journeys/${params.id}`);
    revalidatePath(`/tenants/${tenant.slug}/tags`);
  }

  return NextResponse.json({ ok: true });
}
