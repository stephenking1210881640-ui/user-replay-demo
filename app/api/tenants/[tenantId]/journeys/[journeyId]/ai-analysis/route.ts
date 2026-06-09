import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { generateJourneyAiAnalysisWithLlm } from "@/lib/agent2-llm";
import { buildJourneyAiAnalysisOutput } from "@/lib/journey-ai-analysis";
import { prisma } from "@/lib/prisma";

function toJsonValue(value: unknown) {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: { tenantId: string; journeyId: string };
  },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    return NextResponse.json({ ok: false, error: "未找到租户。" }, { status: 404 });
  }

  const journey = await prisma.journey.findFirst({
    where: {
      tenantId: tenant.id,
      id: params.journeyId,
    },
    include: {
      application: true,
      user: {
        include: {
          userTags: {
            include: {
              tag: true,
            },
          },
        },
      },
      journeyTags: {
        include: {
          tag: true,
        },
      },
      events: {
        orderBy: { seq: "asc" },
      },
      evidences: {
        include: {
          journeyEvent: true,
        },
        orderBy: { offsetMs: "asc" },
      },
      browserEvents: {
        orderBy: { timestamp: "asc" },
        take: 200,
      },
    },
  });

  if (!journey) {
    return NextResponse.json({ ok: false, error: "未找到旅程。" }, { status: 404 });
  }

  const profile = await prisma.applicationAiProfile.findFirst({
    where: {
      tenantId: tenant.id,
      applicationId: journey.applicationId,
    },
    orderBy: { generatedAt: "desc" },
  });

  const heuristicAnalysis = buildJourneyAiAnalysisOutput(journey, profile);
  const generation = await generateJourneyAiAnalysisWithLlm({
    journey,
    profile,
    heuristicAnalysis,
  });

  const savedAnalysis = await prisma.journeyAiAnalysis.create({
    data: {
      tenantId: journey.tenantId,
      applicationId: journey.applicationId,
      journeyId: journey.id,
      goal: generation.analysis.journeyGoal,
      goalConfidence: generation.analysis.goalConfidence,
      processSummary: generation.analysis.processSummary,
      outcomeStatus: generation.analysis.outcome.status,
      outcomeReason: generation.analysis.outcome.reason,
      outcomeConfidence: generation.analysis.outcome.confidence,
      keyStagesJson: generation.analysis.keyStages as unknown as Prisma.InputJsonValue,
      blockersJson: generation.analysis.blockers as unknown as Prisma.InputJsonValue,
      anomaliesJson: generation.analysis.anomalies as unknown as Prisma.InputJsonValue,
      evidenceJson: generation.analysis.evidence as unknown as Prisma.InputJsonValue,
      insightsJson: generation.analysis.productInsights as unknown as Prisma.InputJsonValue,
      agent1RulesJson: generation.analysis.agent1Rules
        ? (generation.analysis.agent1Rules as unknown as Prisma.InputJsonValue)
        : undefined,
      modelVersion:
        generation.modelMetadata.generationMode === "llm"
          ? "agent2-llm-v1"
          : generation.modelMetadata.generationMode === "llm_fallback"
            ? "agent2-llm-fallback-v1"
            : "agent2-rules-v1",
      generatedAt: new Date(),
    },
    select: {
      id: true,
      modelVersion: true,
      outcomeStatus: true,
      generatedAt: true,
    },
  });

  try {
    if (generation.modelInteractionLog) {
      const log = generation.modelInteractionLog;
      await prisma.agent2ModelInteractionLog.create({
        data: {
          tenantId: tenant.id,
          applicationId: journey.applicationId,
          journeyId: journey.id,
          analysisId: savedAnalysis.id,
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
        applicationId: journey.applicationId,
        level: "warn",
        status: "LOG_FAILED",
        source: "agent2.model-interaction-log",
        message: logError instanceof Error ? logError.message : "Agent2 模型交互日志写入失败。",
        payloadSummary: `journeyId=${journey.id}; analysisId=${savedAnalysis.id}`,
      },
    });
  }

  await prisma.integrationLog.create({
    data: {
      tenantId: tenant.id,
      applicationId: journey.applicationId,
      level: generation.modelMetadata.fallbackUsed ? "warn" : "info",
      status: generation.modelMetadata.fallbackUsed ? "FALLBACK" : "ACCEPTED",
      source: "agent2.journey-analysis",
      message: generation.modelMetadata.fallbackUsed
        ? "Agent2 已生成旅程分析，但模型增强失败或未启用，本次使用规则回退结果。"
        : "Agent2 已完成单旅程模型增强分析。",
      payloadSummary: `journeyCode=${journey.journeyCode}; mode=${generation.modelMetadata.generationMode}; model=${generation.modelMetadata.model}; outcome=${savedAnalysis.outcomeStatus}`,
    },
  });

  revalidatePath(`/tenants/${tenant.slug}/journeys/${journey.id}`);
  revalidatePath(`/tenants/${tenant.slug}/journeys`);

  return NextResponse.json({
    ok: true,
    tenant,
    journeyId: journey.id,
    analysis: savedAnalysis,
    summary: {
      generationMode: generation.modelMetadata.generationMode,
      fallbackUsed: generation.modelMetadata.fallbackUsed,
      model: generation.modelMetadata.model,
      latencyMs: generation.modelMetadata.latencyMs,
      outcomeStatus: savedAnalysis.outcomeStatus,
    },
  });
}
