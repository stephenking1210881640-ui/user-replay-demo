import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { generateApplicationAiProfileWithLlm } from "@/lib/agent1-llm";
import {
  buildHeuristicApplicationAiProfile,
  crawlApplicationSnapshot,
  toApplicationAiProfileCreateData,
} from "@/lib/application-ai-profiler";
import { prisma } from "@/lib/prisma";

function normalizeWebsiteInput(value: unknown, fallbackHost: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallbackHost;
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

function toJsonValue(value: unknown) {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: { tenantId: string; appId: string };
  },
) {
  const body = await request.json().catch(() => ({}));
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: "未找到租户。" }, { status: 404 });
  }

  const application = await prisma.application.findFirst({
    where: {
      tenantId: tenant.id,
      id: params.appId,
    },
    select: {
      id: true,
      name: true,
      host: true,
    },
  });

  if (!application) {
    return NextResponse.json({ ok: false, error: "未找到应用。" }, { status: 404 });
  }

  const websiteUrl = normalizeWebsiteInput(body?.websiteUrl, application.host);
  const businessHint = typeof body?.businessHint === "string" ? body.businessHint : null;

  try {
    const agentInput = {
      tenantId: tenant.id,
      applicationId: application.id,
      websiteUrl,
      businessHint,
    };
    const crawlSnapshot = await crawlApplicationSnapshot(agentInput);
    const heuristicProfile = buildHeuristicApplicationAiProfile(agentInput, crawlSnapshot);
    const generation = await generateApplicationAiProfileWithLlm({
      input: agentInput,
      crawlSnapshot,
      heuristicProfile,
    });

    const savedProfile = await prisma.applicationAiProfile.create({
      data: toApplicationAiProfileCreateData(
        agentInput,
        generation.profile,
        {
          inputSnapshot: crawlSnapshot,
          modelOutput: generation.modelOutput,
          modelMetadata: generation.modelMetadata,
          provider: generation.modelMetadata.provider,
          model: generation.modelMetadata.model,
          promptVersion: generation.modelMetadata.promptVersion,
          generationMode: generation.modelMetadata.generationMode,
          fallbackUsed: generation.modelMetadata.fallbackUsed,
        },
      ),
      select: {
        id: true,
        sourceUrl: true,
        appPurpose: true,
        generatedAt: true,
        version: true,
        provider: true,
        model: true,
        generationMode: true,
        fallbackUsed: true,
      },
    });

    try {
      if (generation.modelInteractionLog) {
        const log = generation.modelInteractionLog;
        await prisma.agent1ModelInteractionLog.create({
          data: {
            tenantId: tenant.id,
            applicationId: application.id,
            profileId: savedProfile.id,
            provider: log.provider,
            model: log.model,
            baseUrl: log.baseUrl,
            promptVersion: log.promptVersion,
            status: log.status,
            generationMode: log.generationMode,
            inputSystemPrompt: log.inputSystemPrompt,
            inputUserPrompt: log.inputUserPrompt,
            responseText: log.responseText,
            responseJson: toJsonValue(log.responseJson),
            parsedOutputJson: toJsonValue(log.parsedOutputJson),
            errorMessage: log.errorMessage,
            latencyMs: log.latencyMs,
            tokenUsageJson: toJsonValue(log.tokenUsage),
          },
        });
      }
    } catch (logError) {
      await prisma.integrationLog.create({
        data: {
          tenantId: tenant.id,
          applicationId: application.id,
          level: "warn",
          status: "LOG_FAILED",
          source: "agent1.model-interaction-log",
          message: logError instanceof Error ? logError.message : "Agent1 模型交互日志写入失败。",
          payloadSummary: `profileId=${savedProfile.id}`,
        },
      });
    }

    await prisma.integrationLog.create({
      data: {
        tenantId: tenant.id,
        applicationId: application.id,
        level: "info",
        status: "ACCEPTED",
        source: "agent1.application-profiler",
        message: generation.modelMetadata.fallbackUsed
          ? "Agent1 已完成应用结构理解，模型增强失败或未启用，本次使用规则回退结果。"
          : "Agent1 已完成应用结构理解与模型增强埋点策略分析。",
        payloadSummary: `sourceUrl=${savedProfile.sourceUrl}; mode=${generation.modelMetadata.generationMode}; model=${generation.modelMetadata.model}; pages=${generation.profile.pageMap.length}; regions=${generation.profile.regions.length}; tracks=${generation.profile.sdkRecommendations.length}`,
      },
    });

    revalidatePath(`/tenants/${tenant.slug}/applications/${application.id}`);
    revalidatePath(`/tenants/${tenant.slug}/applications`);

    return NextResponse.json({
      ok: true,
      tenant,
      application,
      profileId: savedProfile.id,
      profile: savedProfile,
      summary: {
        pageCount: generation.profile.pageMap.length,
        regionCount: generation.profile.regions.length,
        interactiveElementCount: generation.profile.interactiveElements.length,
        sdkRecommendationCount: generation.profile.sdkRecommendations.length,
        generationMode: generation.modelMetadata.generationMode,
        fallbackUsed: generation.modelMetadata.fallbackUsed,
      },
    });
  } catch (error) {
    await prisma.integrationLog.create({
      data: {
        tenantId: tenant.id,
        applicationId: application.id,
        level: "error",
        status: "REJECTED",
        source: "agent1.application-profiler",
        message: error instanceof Error ? error.message : "Agent1 分析失败。",
        payloadSummary: `sourceUrl=${websiteUrl}`,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Agent1 分析失败。",
      },
      { status: 500 },
    );
  }
}
