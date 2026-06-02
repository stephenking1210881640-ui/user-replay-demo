import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const application = await prisma.application.findFirst();

  if (!application) {
    return NextResponse.json({ error: "未找到应用空间。" }, { status: 400 });
  }

  if (!body?.name || !body?.goal || !body?.ownerName) {
    return NextResponse.json({ error: "缺少必要字段 name / goal / ownerName。" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      applicationId: application.id,
      name: body.name,
      goal: body.goal,
      ownerName: body.ownerName,
      focusArea: body.focusArea ?? "自定义研究主题",
      description: body.description ?? body.goal,
      filterTimeRangeLabel: body.filterTimeRangeLabel ?? "手工创建",
      filterPageTemplates: body.filterPageTemplates ?? "",
      filterStatuses: body.filterStatuses ?? "",
      filterTagRules: body.filterTagRules ?? "",
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}

