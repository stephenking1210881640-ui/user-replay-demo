import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { TagSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const existing = await prisma.tag.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "标签不存在。" }, { status: 404 });
  }

  const source = body.source && Object.values(TagSource).includes(body.source)
    ? body.source
    : existing.source;

  const tag = await prisma.tag.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() || existing.name,
      color: body.color?.trim() || existing.color,
      description:
        typeof body.description === "string" ? body.description.trim() || null : existing.description,
      source,
    },
  });

  revalidatePath("/tags");
  revalidatePath("/users");
  revalidatePath("/journeys");
  if (existing.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: existing.tenantId },
      select: { slug: true },
    });
    if (tenant) {
      revalidatePath(`/tenants/${tenant.slug}/tags`);
      revalidatePath(`/tenants/${tenant.slug}/users`);
      revalidatePath(`/tenants/${tenant.slug}/journeys`);
    }
  }

  return NextResponse.json({ tag });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    await request.json();
  } catch {
    // ignore empty body
  }

  const existing = await prisma.tag.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "标签不存在。" }, { status: 404 });
  }

  await prisma.tag.delete({
    where: { id: params.id },
  });

  revalidatePath("/tags");
  revalidatePath("/users");
  revalidatePath("/journeys");
  if (existing.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: existing.tenantId },
      select: { slug: true },
    });
    if (tenant) {
      revalidatePath(`/tenants/${tenant.slug}/tags`);
      revalidatePath(`/tenants/${tenant.slug}/users`);
      revalidatePath(`/tenants/${tenant.slug}/journeys`);
    }
  }

  return NextResponse.json({ ok: true });
}
