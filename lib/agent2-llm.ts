import { z } from "zod";

import type {
  Agent2JourneyAnalysisOutput,
  Agent2OutcomeStatus,
  Agent2Severity,
  ApplicationAiProfileForAgent2,
  JourneyForAgent2,
} from "@/lib/journey-ai-analysis";
import { sanitizeJourneyAiAnalysisOutput } from "@/lib/journey-ai-analysis";

const promptVersion = "agent2-llm-journey-analysis-v1";
const defaultBaseUrl = "https://it-ai.fineres.com/v1";
const defaultProvider = "bailian";
const defaultModel = "qwen3.6-plus";
const requestTimeoutMs = 45_000;

export type Agent2ModelMetadata = {
  provider: string;
  model: string;
  baseUrl: string;
  promptVersion: string;
  generationMode: "rules" | "llm" | "llm_fallback";
  fallbackUsed: boolean;
  enabled: boolean;
  latencyMs: number;
  error?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export type Agent2ModelInteractionLog = {
  provider: string;
  model: string;
  baseUrl: string;
  promptVersion: string;
  status: "success" | "failed";
  generationMode: "llm" | "llm_fallback";
  inputSystemPrompt: string;
  inputUserPrompt: string;
  responseText?: string;
  responseJson?: unknown;
  parsedOutputJson?: unknown;
  errorMessage?: string;
  latencyMs: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export type Agent2LlmGenerationResult = {
  analysis: Agent2JourneyAnalysisOutput;
  modelOutput?: unknown;
  modelMetadata: Agent2ModelMetadata;
  modelInteractionLog?: Agent2ModelInteractionLog;
};

const confidenceSchema = z.coerce.number().min(0).max(1).catch(0.6);
const outcomeStatusSchema = z.enum(["success", "failed", "unfinished", "unknown"]).catch("unknown");
const severitySchema = z.enum(["info", "warning", "critical"]).catch("warning");

const keyStageSchema = z.object({
  key: z.string().min(1).catch("stage"),
  title: z.string().min(1).catch("关键阶段"),
  description: z.string().catch("模型识别出的关键旅程阶段。"),
  offsetMs: z.coerce.number().int().min(0).catch(0),
  eventIds: z.array(z.string()).catch([]),
  evidenceIds: z.array(z.string()).catch([]),
  confidence: confidenceSchema,
});

const blockerSchema = z.object({
  key: z.string().min(1).catch("blocker"),
  title: z.string().min(1).catch("阻塞点"),
  description: z.string().catch("模型识别出的潜在阻塞点。"),
  severity: severitySchema,
  eventIds: z.array(z.string()).catch([]),
  evidenceIds: z.array(z.string()).catch([]),
  offsetMs: z.coerce.number().int().min(0).optional(),
});

const anomalySchema = z.object({
  key: z.string().min(1).catch("anomaly"),
  title: z.string().min(1).catch("异常"),
  description: z.string().catch("模型识别出的异常信号。"),
  severity: severitySchema,
  eventIds: z.array(z.string()).catch([]),
  evidenceIds: z.array(z.string()).catch([]),
  offsetMs: z.coerce.number().int().min(0).optional(),
});

const evidenceSchema = z.object({
  id: z.string().min(1).catch("evidence"),
  type: z.enum(["event", "evidence", "request", "agent1_rule"]).catch("event"),
  title: z.string().min(1).catch("关键证据"),
  description: z.string().catch("支撑模型判断的关键证据。"),
  source: z.string().catch("model"),
  eventId: z.string().optional(),
  evidenceId: z.string().optional(),
  offsetMs: z.coerce.number().int().min(0).optional(),
});

const insightSchema = z.object({
  key: z.string().min(1).catch("insight"),
  title: z.string().min(1).catch("产品洞察"),
  description: z.string().catch("模型输出的产品洞察。"),
  impact: z.enum(["low", "medium", "high"]).catch("medium"),
  recommendation: z.string().catch("建议结合更多同类旅程继续验证。"),
});

const llmAnalysisSchema = z.object({
  journeyGoal: z.string().min(1),
  goalConfidence: confidenceSchema,
  processSummary: z.string().min(1),
  keyStages: z.array(keyStageSchema).catch([]),
  outcome: z.object({
    status: outcomeStatusSchema,
    reason: z.string().min(1).catch("模型基于旅程状态和证据做出的达成判断。"),
    confidence: confidenceSchema,
  }),
  blockers: z.array(blockerSchema).catch([]),
  anomalies: z.array(anomalySchema).catch([]),
  evidence: z.array(evidenceSchema).catch([]),
  productInsights: z.array(insightSchema).catch([]),
});

function getLlmConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  const provider = process.env.AGENT2_PROVIDER || process.env.AGENT1_PROVIDER || defaultProvider;
  const model = process.env.AGENT2_MODEL || process.env.AGENT1_MODEL || defaultModel;
  const enabled = process.env.AGENT2_LLM_ENABLED !== "0" && Boolean(apiKey);

  return { apiKey, baseUrl, provider, model, enabled };
}

function truncate(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildJourneySnapshot(journey: JourneyForAgent2, profile: ApplicationAiProfileForAgent2 | null) {
  return {
    tenantId: journey.tenantId,
    application: {
      id: journey.applicationId,
      name: journey.application.name,
      appKey: journey.application.appKey,
      host: journey.application.host,
    },
    journey: {
      id: journey.id,
      journeyCode: journey.journeyCode,
      title: journey.title,
      startedAt: journey.startedAt.toISOString(),
      endedAt: journey.endedAt.toISOString(),
      totalDurationMs: journey.totalDurationMs,
      effectiveDurationMs: journey.effectiveDurationMs,
      pageCount: journey.pageCount,
      keyActionCount: journey.keyActionCount,
      requestCount: journey.requestCount,
      resultStatus: journey.resultStatus,
      hasAnomaly: journey.hasAnomaly,
      pageUrl: journey.pageUrl,
      pageTemplate: journey.pageTemplate,
      pageTitle: journey.pageTitle,
      businessActionType: journey.businessActionType,
      existingSummary: {
        short: journey.aiSummaryShort,
        scenario: journey.aiScenarioSummary,
        process: journey.aiProcessSummary,
        goal: journey.aiGoalAnalysis,
        anomaly: journey.aiAnomalyAnalysis,
      },
    },
    user: {
      id: journey.user.id,
      externalId: journey.user.externalId,
      name: journey.user.name,
      deviceType: journey.user.deviceType,
      os: journey.user.os,
      browser: journey.user.browser,
      tags: journey.user.userTags.map(({ tag }) => tag.name),
    },
    journeyTags: journey.journeyTags.map(({ tag }) => tag.name),
    timeline: journey.events.slice(0, 80).map((event) => ({
      id: event.id,
      seq: event.seq,
      type: event.type,
      title: event.title,
      description: truncate(event.description, 240),
      offsetMs: event.offsetMs,
      pageUrl: event.pageUrl,
      pageTemplate: event.pageTemplate,
      region: event.region,
      uiAction: event.uiAction,
      businessAction: event.businessAction,
      businessIntent: event.businessIntent,
      targetLabel: event.targetLabel,
      targetRole: event.targetRole,
      requestUrl: event.requestUrl,
      method: event.method,
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      requestOutcome: event.requestOutcome,
      uiFeedback: event.uiFeedback,
      isAnomaly: event.isAnomaly,
    })),
    requestEvents: journey.events
      .filter((event) => event.type === "REQUEST" || event.requestUrl || event.statusCode)
      .slice(0, 30)
      .map((event) => ({
        id: event.id,
        title: event.title,
        requestUrl: event.requestUrl,
        method: event.method,
        statusCode: event.statusCode,
        durationMs: event.durationMs,
        requestOutcome: event.requestOutcome,
        offsetMs: event.offsetMs,
        isAnomaly: event.isAnomaly,
      })),
    errorEvents: journey.events
      .filter((event) => event.isAnomaly || event.type === "ANOMALY")
      .slice(0, 30)
      .map((event) => ({
        id: event.id,
        title: event.title,
        description: truncate(event.description, 240),
        uiFeedback: event.uiFeedback,
        offsetMs: event.offsetMs,
      })),
    evidences: journey.evidences.slice(0, 30).map((evidence) => ({
      id: evidence.id,
      journeyEventId: evidence.journeyEventId,
      type: evidence.type,
      title: evidence.title,
      description: truncate(evidence.description, 260),
      severity: evidence.severity,
      content: truncate(evidence.content, 400),
      offsetMs: evidence.offsetMs,
    })),
    agent1Rules: profile
      ? {
          profileId: profile.id,
          generatedAt: profile.generatedAt.toISOString(),
          appPurpose: profile.appPurpose,
          businessJourneys: profile.journeysJson,
          successRules: profile.successRulesJson,
          failureRules: profile.failureRulesJson,
          sdkRecommendations: profile.sdkRecommendationsJson,
          regions: profile.regionsJson,
        }
      : null,
  };
}

function buildSystemPrompt() {
  return [
    "你是 Agent2：单旅程整理与分析 Agent。",
    "你的任务是基于一条用户旅程的结构化事件、请求、错误、证据和 Agent1 应用规则，判断用户目标、过程、达成状态、阻塞点、异常证据和产品洞察。",
    "如果输入中存在 Agent1 应用级业务规则，必须优先结合核心业务旅程、成功定义和失败定义判断 journeyGoal 与 outcome。",
    "如果输入中不存在 Agent1 应用级业务规则，需要在 productInsights 中提示当前为通用分析模式，目标和达成判断置信度会下降。",
    "必须输出严格 JSON，不要输出 Markdown、解释文字或代码块。",
    "不要编造不存在的事件、请求或证据；所有 blockers/anomalies/evidence 必须尽量引用输入中的 eventIds 或 evidenceIds。",
    "必须区分 outcome.status：success / failed / unfinished / unknown。",
    "字段名必须使用英文 key，字段内容使用简体中文。",
    "所有给用户看的字段必须使用业务语言，不要出现技术或前端工程词汇，例如 HTTP、接口、请求、SDK、track、DOM、region、CTA、前端、selector、token、appKey、网络、代码。",
    "可以把技术证据翻译为业务表达，例如“服务返回异常”“等待时间偏长”“关键操作没有完成”“页面反馈提示失败”。",
    "confidence 必须是 0 到 1 的数字。",
  ].join("\n");
}

function buildUserPrompt(input: {
  journey: JourneyForAgent2;
  profile: ApplicationAiProfileForAgent2 | null;
  heuristicAnalysis: Agent2JourneyAnalysisOutput;
}) {
  const payload = {
    journeySnapshot: buildJourneySnapshot(input.journey, input.profile),
    applicationRuleContext: input.heuristicAnalysis.agent1Rules
      ? {
          hasProfile: input.heuristicAnalysis.agent1Rules.hasProfile,
          appPurpose: input.heuristicAnalysis.agent1Rules.appPurpose,
          matchedBusinessJourneys: input.heuristicAnalysis.agent1Rules.matchedBusinessJourneys,
          matchedSuccessRules: input.heuristicAnalysis.agent1Rules.matchedSuccessRules,
          matchedFailureRules: input.heuristicAnalysis.agent1Rules.matchedFailureRules,
          matchedBusinessIntents: input.heuristicAnalysis.agent1Rules.matchedBusinessIntents,
          confidenceNote: input.heuristicAnalysis.agent1Rules.confidenceNote,
        }
      : null,
    ruleBasedAnalysis: input.heuristicAnalysis,
    outputContract: [
      "只返回一个 JSON 对象，不要 Markdown。",
      "必须包含 journeyGoal、goalConfidence、processSummary、keyStages、outcome、blockers、anomalies、evidence、productInsights。",
      "keyStages 最多 6 项；blockers 最多 5 项；anomalies 最多 5 项；evidence 最多 8 项；productInsights 最多 5 项。",
      "outcome.status 只能是 success/failed/unfinished/unknown。",
      "severity 只能是 info/warning/critical；impact 只能是 low/medium/high。",
      "如果模型判断和 ruleBasedAnalysis 不同，需要在 outcome.reason 中说明证据依据。",
      "如果 applicationRuleContext.hasProfile=true，需要在 outcome.reason 或 evidence 中体现引用了应用级成功/失败定义。",
      "如果 applicationRuleContext.hasProfile=false，需要降低 goalConfidence/outcome.confidence，并在 productInsights 中说明缺少应用级业务规则。",
      "所有面向用户的文案必须是业务语言，不要出现 HTTP、接口、请求、SDK、track、DOM、region、CTA、前端、selector、token、appKey、网络、代码等技术词。",
      "所有 eventIds / evidenceIds 必须来自输入，不能虚构。",
    ],
  };

  return `请基于以下 JSON 输入输出标准 Agent2 JSON 结果：\n${JSON.stringify(payload)}`;
}

function stripReasoningAndCodeFence(content: string) {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseJsonFromModelContent(content: string) {
  const cleaned = stripReasoningAndCodeFence(content);
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first === -1 || last === -1 || last <= first) {
      throw new Error("模型未返回可解析的 JSON 对象。");
    }
    return JSON.parse(cleaned.slice(first, last + 1));
  }
}

function normalizeModelAnalysis(
  modelOutput: unknown,
  heuristicAnalysis: Agent2JourneyAnalysisOutput,
): Agent2JourneyAnalysisOutput {
  const parsed = llmAnalysisSchema.parse(modelOutput);
  return sanitizeJourneyAiAnalysisOutput({
    ...heuristicAnalysis,
    journeyGoal: parsed.journeyGoal,
    goalConfidence: parsed.goalConfidence,
    processSummary: parsed.processSummary,
    keyStages: parsed.keyStages.length ? parsed.keyStages : heuristicAnalysis.keyStages,
    outcome: {
      status: parsed.outcome.status as Agent2OutcomeStatus,
      reason: parsed.outcome.reason,
      confidence: parsed.outcome.confidence,
    },
    blockers: parsed.blockers.length
      ? parsed.blockers.map((blocker) => ({ ...blocker, severity: blocker.severity as Agent2Severity }))
      : heuristicAnalysis.blockers,
    anomalies: parsed.anomalies.length
      ? parsed.anomalies.map((anomaly) => ({ ...anomaly, severity: anomaly.severity as Agent2Severity }))
      : heuristicAnalysis.anomalies,
    evidence: parsed.evidence.length ? parsed.evidence : heuristicAnalysis.evidence,
    productInsights: parsed.productInsights.length ? parsed.productInsights : heuristicAnalysis.productInsights,
  });
}

export async function generateJourneyAiAnalysisWithLlm(input: {
  journey: JourneyForAgent2;
  profile: ApplicationAiProfileForAgent2 | null;
  heuristicAnalysis: Agent2JourneyAnalysisOutput;
}): Promise<Agent2LlmGenerationResult> {
  const config = getLlmConfig();
  const startedAt = Date.now();

  if (!config.enabled || !config.apiKey) {
    return {
      analysis: input.heuristicAnalysis,
      modelMetadata: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        generationMode: "rules",
        fallbackUsed: true,
        enabled: false,
        latencyMs: Date.now() - startedAt,
        error: "未配置模型密钥或 AGENT2_LLM_ENABLED=0。",
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const inputSystemPrompt = buildSystemPrompt();
  const inputUserPrompt = buildUserPrompt(input);
  let responseText: string | undefined;
  let responseJson: unknown;
  let parsedOutputJson: unknown;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: inputSystemPrompt },
          { role: "user", content: inputUserPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2400,
        stream: false,
        response_format: { type: "json_object" },
        enable_thinking: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      responseText = errorText || undefined;
      throw new Error(`模型调用失败：HTTP ${response.status}${errorText ? ` ${errorText.slice(0, 180)}` : ""}`);
    }

    const payload = await response.json();
    responseJson = payload;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("模型响应缺少 choices[0].message.content。");
    }
    responseText = content;

    const modelOutput = parseJsonFromModelContent(content);
    parsedOutputJson = modelOutput;
    const analysis = normalizeModelAnalysis(modelOutput, input.heuristicAnalysis);
    const latencyMs = Date.now() - startedAt;
    const tokenUsage = {
      inputTokens: payload?.usage?.prompt_tokens,
      outputTokens: payload?.usage?.completion_tokens,
      totalTokens: payload?.usage?.total_tokens,
    };

    return {
      analysis,
      modelOutput,
      modelMetadata: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        generationMode: "llm",
        fallbackUsed: false,
        enabled: true,
        latencyMs,
        tokenUsage,
      },
      modelInteractionLog: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        status: "success",
        generationMode: "llm",
        inputSystemPrompt,
        inputUserPrompt,
        responseText,
        responseJson,
        parsedOutputJson,
        latencyMs,
        tokenUsage,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败。";
    const latencyMs = Date.now() - startedAt;
    return {
      analysis: input.heuristicAnalysis,
      modelMetadata: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        generationMode: "llm_fallback",
        fallbackUsed: true,
        enabled: true,
        latencyMs,
        error: message,
      },
      modelInteractionLog: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        status: "failed",
        generationMode: "llm_fallback",
        inputSystemPrompt,
        inputUserPrompt,
        responseText,
        responseJson,
        parsedOutputJson,
        errorMessage: message,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
