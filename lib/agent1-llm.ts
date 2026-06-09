import { z } from "zod";

import type {
  Agent1CrawlSnapshot,
  ApplicationAiProfileInput,
  ApplicationAiProfileOutput,
} from "@/lib/application-ai-profiler";
import { getAiModelRuntimeConfig } from "@/lib/ai-model-config";

const promptVersion = "agent1-llm-profile-v1";
const requestTimeoutMs = 45_000;

type Agent1LlmInput = {
  input: ApplicationAiProfileInput;
  crawlSnapshot: Agent1CrawlSnapshot;
  heuristicProfile: ApplicationAiProfileOutput;
};

export type Agent1ModelMetadata = {
  provider: string;
  model: string;
  baseUrl: string;
  promptVersion: string;
  generationMode: "heuristic" | "llm" | "llm_fallback";
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

export type Agent1ModelInteractionLog = {
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

export type Agent1LlmGenerationResult = {
  profile: ApplicationAiProfileOutput;
  modelOutput?: unknown;
  modelMetadata: Agent1ModelMetadata;
  modelInteractionLog?: Agent1ModelInteractionLog;
};

const confidenceSchema = z.coerce.number().min(0).max(1).catch(0.6);

const appSummarySchema = z.object({
  purpose: z.string().min(1),
  primaryAudience: z.string().min(1).catch("目标应用访问用户"),
  valueProposition: z.string().min(1).catch("帮助用户完成关键业务操作。"),
  evidence: z.array(z.string()).catch([]),
});

const pageMapSchema = z.object({
  url: z.string().catch(""),
  path: z.string().catch("/"),
  title: z.string().catch("未命名页面"),
  purpose: z.string().catch("内容浏览与关键动作引导"),
  keyRegions: z.array(z.string()).catch([]),
  keyInteractions: z.array(z.string()).catch([]),
});

const regionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).catch("业务区域"),
  pages: z.array(z.string()).catch([]),
  description: z.string().catch("由页面结构和交互元素推断出的业务区域。"),
  detectionStrategy: z.string().catch("基于页面结构、文本和交互元素推断"),
  suggestedDataAttribute: z.string().catch(""),
  confidence: confidenceSchema,
});

const interactiveElementSchema = z.object({
  id: z.string().min(1).catch("interactive_element"),
  pageUrl: z.string().catch(""),
  pagePath: z.string().catch("/"),
  elementType: z.string().catch("button"),
  label: z.string().catch("未命名交互"),
  href: z.string().optional(),
  action: z.string().optional(),
  method: z.string().optional(),
  selectorHint: z.string().catch(""),
  regionKey: z.string().catch("content_area"),
  regionLabel: z.string().catch("内容主体区"),
  businessMeaning: z.string().catch("触发页面交互"),
  suggestedTrackEvent: z.string().catch("business_action_clicked"),
  suggestedPayload: z.record(z.string(), z.string()).catch({}),
  confidence: confidenceSchema,
});

const businessJourneySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1).catch("核心业务旅程"),
  goal: z.string().catch("用户完成目标应用中的关键业务目标。"),
  entryPages: z.array(z.string()).catch([]),
  keySteps: z.array(z.string()).catch([]),
  successSignals: z.array(z.string()).catch([]),
  failureSignals: z.array(z.string()).catch([]),
  recommendedTrackEvents: z.array(z.string()).catch([]),
});

const successSignalSchema = z.object({
  key: z.string().min(1),
  label: z.string().catch("成功信号"),
  ruleType: z.enum(["page", "event", "request", "ui"]).catch("event"),
  rule: z.string().catch("出现关键成功事件"),
  confidence: confidenceSchema,
});

const failureSignalSchema = z.object({
  key: z.string().min(1),
  label: z.string().catch("失败信号"),
  ruleType: z.enum(["page", "event", "request", "ui"]).catch("event"),
  rule: z.string().catch("出现关键失败事件或请求异常"),
  severity: z.enum(["warning", "critical"]).catch("warning"),
  confidence: confidenceSchema,
});

const sdkRecommendationSchema = z.object({
  eventName: z.string().min(1),
  trigger: z.string().catch("用户触发关键业务交互"),
  regionKey: z.string().catch("content_area"),
  businessMeaning: z.string().catch("补充业务动作语义"),
  suggestedPayload: z.record(z.string(), z.string()).catch({}),
  suggestedDataAttributes: z.record(z.string(), z.string()).catch({}),
  priority: z.enum(["high", "medium", "low"]).catch("medium"),
});

const confidenceNoteSchema = z.object({
  topic: z.string().catch("置信度说明"),
  note: z.string().catch("模型基于有限页面结构进行推断，建议结合真实事件继续校准。"),
  confidence: confidenceSchema,
});

const llmProfileSchema = z.object({
  appSummary: appSummarySchema,
  pageMap: z.array(pageMapSchema).catch([]),
  regions: z.array(regionSchema).catch([]),
  interactiveElements: z.array(interactiveElementSchema).catch([]),
  businessJourneys: z.array(businessJourneySchema).catch([]),
  successSignals: z.array(successSignalSchema).catch([]),
  failureSignals: z.array(failureSignalSchema).catch([]),
  sdkRecommendations: z.array(sdkRecommendationSchema).catch([]),
  confidenceNotes: z.array(confidenceNoteSchema).catch([]),
});

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function buildPromptSnapshot(snapshot: Agent1CrawlSnapshot) {
  return {
    sourceUrl: snapshot.sourceUrl,
    normalizedUrl: snapshot.normalizedUrl,
    crawledAt: snapshot.crawledAt,
    crawledPageCount: snapshot.crawledPageCount,
    skippedUrls: snapshot.skippedUrls.slice(0, 8),
    pages: snapshot.pages.slice(0, 4).map((page) => ({
      url: page.url,
      path: page.path,
      title: page.title,
      description: truncate(page.description, 300),
      headings: page.headings.slice(0, 10),
      textSample: truncate(page.textSample, 700),
      sections: page.sections.slice(0, 8).map((section) => ({
        type: section.type,
        label: section.label,
        selectorHint: section.selectorHint,
        source: section.source,
        text: truncate(section.text, 180),
      })),
      interactiveElements: page.interactiveElements.slice(0, 18).map((element) => ({
        elementType: element.elementType,
        label: element.label,
        href: element.href,
        action: element.action,
        method: element.method,
        selectorHint: element.selectorHint,
        heuristicRegion: element.regionKey,
        heuristicTrackEvent: element.suggestedTrackEvent,
      })),
      links: page.links.slice(0, 12),
    })),
  };
}

function buildSystemPrompt() {
  return [
    "你是 Agent1：应用结构理解与埋点策略 Agent。",
    "你的任务是基于服务端抓取到的页面结构快照，提炼目标应用用途、页面地图、region、关键交互、业务旅程、成功/失败规则和 Browser Collector SDK 埋点建议。",
    "必须输出严格 JSON，不要输出 Markdown、解释文字或代码块。",
    "不要编造不存在的页面或 API；如果证据不足，请在 confidenceNotes 中说明。",
    "字段名必须使用英文 key，字段内容使用简体中文。",
    "confidence 必须是 0 到 1 的数字。",
    "region key 和 eventName 使用 snake_case。",
  ].join("\n");
}

function buildUserPrompt(input: Agent1LlmInput) {
  const payload = {
    tenantId: input.input.tenantId,
    applicationId: input.input.applicationId,
    websiteUrl: input.input.websiteUrl,
    businessHint: input.input.businessHint,
    crawlSnapshot: buildPromptSnapshot(input.crawlSnapshot),
    heuristicProfile: {
      appSummary: input.heuristicProfile.appSummary,
      pageMap: input.heuristicProfile.pageMap.slice(0, 4),
      regions: input.heuristicProfile.regions.slice(0, 8).map((region) => ({
        key: region.key,
        name: region.name,
        description: region.description,
      })),
      businessJourneys: input.heuristicProfile.businessJourneys.slice(0, 4).map((journey) => ({
        key: journey.key,
        name: journey.name,
        goal: journey.goal,
        recommendedTrackEvents: journey.recommendedTrackEvents,
      })),
      sdkRecommendations: input.heuristicProfile.sdkRecommendations.slice(0, 10).map((item) => ({
        eventName: item.eventName,
        trigger: item.trigger,
        regionKey: item.regionKey,
        businessMeaning: item.businessMeaning,
        priority: item.priority,
      })),
    },
    outputContract: [
      "只返回一个 JSON 对象，不要 Markdown。",
      "必须包含 appSummary、pageMap、regions、businessJourneys、successSignals、failureSignals、sdkRecommendations、confidenceNotes。",
      "interactiveElements 可省略；系统会用抓取层结果补全。",
      "每个数组最多 6 项，sdkRecommendations 最多 8 项。",
      "ruleType 只能是 page/event/request/ui；priority 只能是 high/medium/low；severity 只能是 warning/critical。",
      "所有 key 和 eventName 使用 snake_case；字段内容使用简体中文。",
    ],
  };

  return `请基于以下 JSON 输入输出标准 Agent1 JSON 结果：\n${JSON.stringify(payload)}`;
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

function withLlmFallbackNote(profile: ApplicationAiProfileOutput, note: string): ApplicationAiProfileOutput {
  return {
    ...profile,
    confidenceNotes: [
      ...profile.confidenceNotes,
      {
        topic: "模型回退",
        note,
        confidence: 0.45,
      },
    ],
  };
}

function normalizeModelProfile(
  modelOutput: unknown,
  heuristicProfile: ApplicationAiProfileOutput,
): ApplicationAiProfileOutput {
  const parsed = llmProfileSchema.parse(modelOutput);
  return {
    ...parsed,
    pageMap: parsed.pageMap.length ? parsed.pageMap : heuristicProfile.pageMap,
    regions: parsed.regions.length ? parsed.regions : heuristicProfile.regions,
    interactiveElements: parsed.interactiveElements.length ? parsed.interactiveElements : heuristicProfile.interactiveElements,
    businessJourneys: parsed.businessJourneys.length ? parsed.businessJourneys : heuristicProfile.businessJourneys,
    successSignals: parsed.successSignals.length ? parsed.successSignals : heuristicProfile.successSignals,
    failureSignals: parsed.failureSignals.length ? parsed.failureSignals : heuristicProfile.failureSignals,
    sdkRecommendations: parsed.sdkRecommendations.length ? parsed.sdkRecommendations : heuristicProfile.sdkRecommendations,
    confidenceNotes: [
      ...parsed.confidenceNotes,
      {
        topic: "模型增强",
        note: "本次结果由服务端抓取结构化快照后交给 LLM 提炼生成，已通过 schema 校验；缺失字段会回填规则分析结果。",
        confidence: 0.78,
      },
    ],
    crawlMetadata: heuristicProfile.crawlMetadata,
  };
}

export async function generateApplicationAiProfileWithLlm(input: Agent1LlmInput): Promise<Agent1LlmGenerationResult> {
  const config = await getAiModelRuntimeConfig(input.input.tenantId, "agent1");
  const startedAt = Date.now();

  if (!config.enabled || !config.apiKey) {
    return {
      profile: withLlmFallbackNote(input.heuristicProfile, "未配置可用模型或模型配置已停用，本次使用规则分析结果。"),
      modelMetadata: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        promptVersion,
        generationMode: "heuristic",
        fallbackUsed: true,
        enabled: false,
        latencyMs: Date.now() - startedAt,
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
        max_tokens: 2200,
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
    const profile = normalizeModelProfile(modelOutput, input.heuristicProfile);
    const latencyMs = Date.now() - startedAt;
    const tokenUsage = {
      inputTokens: payload?.usage?.prompt_tokens,
      outputTokens: payload?.usage?.completion_tokens,
      totalTokens: payload?.usage?.total_tokens,
    };

    return {
      profile,
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
      profile: withLlmFallbackNote(input.heuristicProfile, `模型增强失败，本次已回退到规则分析结果。失败原因：${message}`),
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
