import { randomBytes } from "node:crypto";

import { ApplicationStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const createableStatuses = [
  ApplicationStatus.ACTIVE,
  ApplicationStatus.PENDING,
  ApplicationStatus.INACTIVE,
] as const;

function normalizeKeySeed(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42);
}

function normalizeHost(value: string) {
  return value.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function makeToken(prefix: string) {
  return `${prefix}_${randomBytes(18).toString("hex")}`;
}

async function generateUniqueAppKey(tenantId: string, seed: string) {
  const normalizedSeed = normalizeKeySeed(seed) || "application";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomBytes(3).toString("hex");
    const appKey = `${normalizedSeed}_${suffix}`;
    const existing = await prisma.application.findUnique({
      where: {
        tenantId_appKey: {
          tenantId,
          appKey,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return appKey;
    }
  }

  return `${normalizedSeed}_${Date.now().toString(36)}`;
}

export async function POST(request: Request, { params }: { params: { tenantId: string } }) {
  const body = await request.json();
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: { id: true, slug: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "未找到当前企业租户。" }, { status: 404 });
  }

  const name = String(body?.name ?? "").trim();
  const keySeed = String(body?.appKey ?? body?.slug ?? name).trim();
  const host = normalizeHost(String(body?.host ?? ""));
  const description = String(body?.description ?? "").trim();
  const status = createableStatuses.includes(body?.status) ? body.status : ApplicationStatus.PENDING;

  if (!name || !host) {
    return NextResponse.json({ error: "请填写应用名称和 host/domain。" }, { status: 400 });
  }

  if (keySeed && !/^[a-zA-Z0-9_-]+$/.test(keySeed)) {
    return NextResponse.json({ error: "应用标识只能包含字母、数字、下划线或连字符。" }, { status: 400 });
  }

  const appKey = await generateUniqueAppKey(tenant.id, keySeed || name);
  const application = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      name,
      appKey,
      host,
      description: description || "新创建的空白应用，等待接入 SDK 并上报首条旅程。",
      status,
      ingestToken: makeToken("igr"),
      lastReportedAt: null,
    },
  });

  revalidatePath(`/tenants/${tenant.slug}/applications`);
  revalidatePath(`/tenants/${tenant.slug}/integration`);
  revalidatePath(`/tenants/${tenant.slug}/overview`);

  return NextResponse.json({ application }, { status: 201 });
}
