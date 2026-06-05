import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { TagSource, TagType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const application = await prisma.application.findFirst();

  if (!application) {
    return NextResponse.json({ error: "未找到应用空间。" }, { status: 400 });
  }

  if (!body?.name || !body?.type) {
    return NextResponse.json({ error: "缺少必要字段 name / type。" }, { status: 400 });
  }

  if (!Object.values(TagType).includes(body.type)) {
    return NextResponse.json({ error: "无效的标签类型。" }, { status: 400 });
  }

  const source = Object.values(TagSource).includes(body.source) ? body.source : TagSource.MANUAL;

  const tag = await prisma.tag.create({
    data: {
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

  return NextResponse.json({ tag }, { status: 201 });
}
