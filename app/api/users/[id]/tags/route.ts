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

  const [user, tag] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id } }),
    prisma.tag.findUnique({ where: { id: tagId } }),
  ]);

  if (!user || !tag) {
    return NextResponse.json({ error: "用户或标签不存在。" }, { status: 404 });
  }

  if (tag.type !== TagType.USER) {
    return NextResponse.json({ error: "该标签不是用户标签。" }, { status: 400 });
  }

  const existing = await prisma.userTag.findUnique({
    where: {
      userId_tagId: {
        userId: params.id,
        tagId,
      },
    },
  });

  if (!existing) {
    await prisma.userTag.create({
      data: {
        userId: params.id,
        tagId,
      },
    });
  }

  revalidatePath("/users");
  revalidatePath(`/users/${params.id}`);
  revalidatePath("/tags");

  return NextResponse.json({ ok: true });
}
