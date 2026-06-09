import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAiModelConfigView, validateAiModelConfigInput } from "@/lib/ai-model-config";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: { tenantId: string };
  },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: "未找到租户。" }, { status: 404 });
  }

  const config = await getAiModelConfigView(tenant.id);

  return NextResponse.json({
    ok: true,
    tenant,
    config,
  });
}

export async function PUT(
  request: Request,
  {
    params,
  }: {
    params: { tenantId: string };
  },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: "未找到租户。" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const existing = await prisma.tenantAiModelConfig.findUnique({
    where: { tenantId: tenant.id },
  });
  const input = {
    provider: body.provider,
    baseUrl: body.baseUrl,
    model: body.model,
    apiKey: typeof body.apiKey === "string" && body.apiKey.trim() ? body.apiKey : existing?.apiKey ?? process.env.OPENAI_API_KEY,
    enabled: body.enabled,
  };
  const parsed = validateAiModelConfigInput(input);

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  await prisma.tenantAiModelConfig.upsert({
    where: { tenantId: tenant.id },
    update: parsed.value,
    create: {
      tenantId: tenant.id,
      ...parsed.value,
    },
  });

  const firstApplication = await prisma.application.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (firstApplication) {
    await prisma.integrationLog.create({
      data: {
        tenantId: tenant.id,
        applicationId: firstApplication.id,
        level: "info",
        status: "ACCEPTED",
        source: "settings.ai-model-config",
        message: "租户 AI 模型配置已更新，Agent1 与 Agent2 后续分析将优先使用该配置。",
        payloadSummary: `provider=${parsed.value.provider}; model=${parsed.value.model}; enabled=${parsed.value.enabled}`,
      },
    });
  }

  revalidatePath(`/tenants/${tenant.slug}/settings`);
  revalidatePath(`/tenants/${tenant.slug}/applications`);
  revalidatePath(`/tenants/${tenant.slug}/journeys`);

  return NextResponse.json({
    ok: true,
    tenant,
    config: await getAiModelConfigView(tenant.id),
  });
}
