import type { Prisma } from "@prisma/client";

export type ApplicationRuleSignal = {
  key?: string;
  label?: string;
  ruleType?: string;
  rule?: string;
  severity?: string;
  confidence?: number;
};

export type ApplicationBusinessJourneyRule = {
  key?: string;
  name?: string;
  goal?: string;
  keySteps?: string[];
  successSignals?: string[];
  failureSignals?: string[];
  recommendedTrackEvents?: string[];
};

export type ApplicationBusinessIntentRule = {
  key: string;
  label: string;
  source: "business_journey" | "sdk_recommendation" | "interactive_element";
  ruleText: string;
  confidence?: number;
};

export type ApplicationRuleMatch<T> = T & {
  matchReason: string;
};

export type ApplicationRuleContext = {
  hasProfile: boolean;
  profileId?: string;
  profileGeneratedAt?: string;
  appPurpose?: string;
  businessJourneys: ApplicationBusinessJourneyRule[];
  successRules: ApplicationRuleSignal[];
  failureRules: ApplicationRuleSignal[];
  suggestedBusinessIntents: ApplicationBusinessIntentRule[];
  matchedBusinessJourneys: Array<ApplicationRuleMatch<ApplicationBusinessJourneyRule>>;
  matchedSuccessRules: Array<ApplicationRuleMatch<ApplicationRuleSignal>>;
  matchedFailureRules: Array<ApplicationRuleMatch<ApplicationRuleSignal>>;
  matchedBusinessIntents: Array<ApplicationRuleMatch<ApplicationBusinessIntentRule>>;
  confidenceNote: string;
};

type ProfileLike = {
  id: string;
  generatedAt: Date;
  appPurpose: string;
  journeysJson: Prisma.JsonValue;
  successRulesJson: Prisma.JsonValue;
  failureRulesJson: Prisma.JsonValue;
  sdkRecommendationsJson: Prisma.JsonValue;
  interactiveElementsJson: Prisma.JsonValue;
};

type JourneyLike = {
  title: string;
  pageUrl: string;
  pageTemplate: string;
  pageTitle: string;
  businessActionType: string;
  aiSummaryShort: string;
  events: Array<{
    title: string;
    description: string;
    region: string | null;
    uiAction: string | null;
    businessAction: string | null;
    businessIntent: string | null;
    targetLabel: string | null;
    targetText: string | null;
    requestUrl: string | null;
    pathTemplate: string | null;
    requestOutcome: string | null;
    uiFeedback: string | null;
    statusCode: number | null;
  }>;
};

function asArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function compactText(items: Array<string | null | undefined>) {
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .join(" ");
}

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s\u4e00-\u9fa5]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeRuleText(value: string) {
  const normalized = normalizeToken(value);
  const tokens = normalized
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !["rule", "event", "request", "page", "button", "click", "status", "http"].includes(item));

  const chinesePhrases = Array.from(normalized.matchAll(/[\u4e00-\u9fa5]{2,}/g)).map((match) => match[0]);
  return Array.from(new Set([...tokens, ...chinesePhrases])).slice(0, 12);
}

function journeyCorpus(journey: JourneyLike) {
  return normalizeToken(
    compactText([
      journey.title,
      journey.pageUrl,
      journey.pageTemplate,
      journey.pageTitle,
      journey.businessActionType,
      journey.aiSummaryShort,
      ...journey.events.flatMap((event) => [
        event.title,
        event.description,
        event.region,
        event.uiAction,
        event.businessAction,
        event.businessIntent,
        event.targetLabel,
        event.targetText,
        event.requestUrl,
        event.pathTemplate,
        event.requestOutcome,
        event.uiFeedback,
        event.statusCode ? `status ${event.statusCode}` : null,
      ]),
    ]),
  );
}

function matchByText<T>(items: T[], getText: (item: T) => string, corpus: string): Array<ApplicationRuleMatch<T>> {
  return items
    .map((item) => {
      const tokens = tokenizeRuleText(getText(item));
      const matched = tokens.find((token) => corpus.includes(token));
      return matched ? { ...item, matchReason: `命中业务语义：${matched}` } : null;
    })
    .filter((item): item is ApplicationRuleMatch<T> => Boolean(item));
}

function sdkRecommendationToIntent(value: unknown): ApplicationBusinessIntentRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const eventName = typeof item.eventName === "string" ? item.eventName : "";
  const businessMeaning = typeof item.businessMeaning === "string" ? item.businessMeaning : "";
  const trigger = typeof item.trigger === "string" ? item.trigger : "";
  if (!eventName && !businessMeaning && !trigger) return null;

  return {
    key: eventName || businessMeaning || trigger,
    label: businessMeaning || trigger || eventName,
    source: "sdk_recommendation",
    ruleText: compactText([eventName, businessMeaning, trigger]),
    confidence: 0.72,
  };
}

function interactiveElementToIntent(value: unknown): ApplicationBusinessIntentRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const label = typeof item.label === "string" ? item.label : "";
  const businessMeaning = typeof item.businessMeaning === "string" ? item.businessMeaning : "";
  const suggestedTrackEvent = typeof item.suggestedTrackEvent === "string" ? item.suggestedTrackEvent : "";
  if (!label && !businessMeaning && !suggestedTrackEvent) return null;

  return {
    key: suggestedTrackEvent || businessMeaning || label,
    label: businessMeaning || label || suggestedTrackEvent,
    source: "interactive_element",
    ruleText: compactText([label, businessMeaning, suggestedTrackEvent]),
    confidence: typeof item.confidence === "number" ? item.confidence : 0.62,
  };
}

function businessJourneyToIntent(journey: ApplicationBusinessJourneyRule): ApplicationBusinessIntentRule | null {
  const label = journey.goal || journey.name || journey.key || "";
  if (!label) return null;

  return {
    key: journey.key || label,
    label,
    source: "business_journey",
    ruleText: compactText([
      journey.key,
      journey.name,
      journey.goal,
      ...(journey.keySteps ?? []),
      ...(journey.recommendedTrackEvents ?? []),
    ]),
    confidence: 0.78,
  };
}

function uniqueIntents(intents: ApplicationBusinessIntentRule[]) {
  const seen = new Set<string>();
  return intents.filter((intent) => {
    const key = normalizeToken(`${intent.key} ${intent.label}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildApplicationRuleContext(profile: ProfileLike | null, journey: JourneyLike): ApplicationRuleContext {
  if (!profile) {
    return {
      hasProfile: false,
      businessJourneys: [],
      successRules: [],
      failureRules: [],
      suggestedBusinessIntents: [],
      matchedBusinessJourneys: [],
      matchedSuccessRules: [],
      matchedFailureRules: [],
      matchedBusinessIntents: [],
      confidenceNote: "未找到 Agent1 应用结构理解结果，Agent2 使用通用旅程分析规则，目标和达成判断置信度会下调。",
    };
  }

  const businessJourneys = asArray<ApplicationBusinessJourneyRule>(profile.journeysJson);
  const successRules = asArray<ApplicationRuleSignal>(profile.successRulesJson);
  const failureRules = asArray<ApplicationRuleSignal>(profile.failureRulesJson);
  const suggestedBusinessIntents = uniqueIntents([
    ...businessJourneys.map(businessJourneyToIntent).filter((item): item is ApplicationBusinessIntentRule => Boolean(item)),
    ...asArray<unknown>(profile.sdkRecommendationsJson)
      .map(sdkRecommendationToIntent)
      .filter((item): item is ApplicationBusinessIntentRule => Boolean(item)),
    ...asArray<unknown>(profile.interactiveElementsJson)
      .map(interactiveElementToIntent)
      .filter((item): item is ApplicationBusinessIntentRule => Boolean(item)),
  ]).slice(0, 12);
  const corpus = journeyCorpus(journey);

  return {
    hasProfile: true,
    profileId: profile.id,
    profileGeneratedAt: profile.generatedAt.toISOString(),
    appPurpose: profile.appPurpose,
    businessJourneys,
    successRules,
    failureRules,
    suggestedBusinessIntents,
    matchedBusinessJourneys: matchByText(
      businessJourneys,
      (item) => compactText([item.key, item.name, item.goal, ...(item.keySteps ?? []), ...(item.recommendedTrackEvents ?? [])]),
      corpus,
    ),
    matchedSuccessRules: matchByText(
      successRules,
      (item) => compactText([item.key, item.label, item.rule, item.ruleType]),
      corpus,
    ),
    matchedFailureRules: matchByText(
      failureRules,
      (item) => compactText([item.key, item.label, item.rule, item.ruleType, item.severity]),
      corpus,
    ),
    matchedBusinessIntents: matchByText(
      suggestedBusinessIntents,
      (item) => compactText([item.key, item.label, item.ruleText]),
      corpus,
    ),
    confidenceNote: "已读取 Agent1 应用级业务规则，Agent2 会优先结合核心业务旅程、成功定义和失败定义判断当前旅程。",
  };
}

export function toBusinessLanguage(value: string) {
  return value
    .replace(/Agent1/g, "应用级规则")
    .replace(/Agent2/g, "旅程分析")
    .replace(/PAGE_VIEW/gi, "页面浏览")
    .replace(/UI_CLICK/gi, "用户点击")
    .replace(/FORM_SUBMIT/gi, "表单提交")
    .replace(/NETWORK_REQUEST/gi, "服务反馈")
    .replace(/BUSINESS_ACTION/gi, "业务动作")
    .replace(/REGION_ACTION/gi, "区域动作")
    .replace(/REQUEST/gi, "服务反馈")
    .replace(/ANOMALY/gi, "异常反馈")
    .replace(/\bAPI\b/gi, "服务")
    .replace(/HTTP\s?\d{3}/gi, "服务返回异常")
    .replace(/status\s?\d{3}/gi, "服务返回异常")
    .replace(/请求返回\s?[-\d]+/g, "服务返回异常")
    .replace(/失败请求[:：]?/g, "服务异常：")
    .replace(/长耗时请求[:：]?/g, "等待时间过长：")
    .replace(/请求耗时\s?\d+ms/g, "等待时间明显偏长")
    .replace(/\d+ms/g, "")
    .replace(/SDK|sdk/g, "业务采集")
    .replace(/track/gi, "业务动作记录")
    .replace(/data-ur-[a-z-]+/gi, "业务语义标记")
    .replace(/region/gi, "业务区域")
    .replace(/selector/gi, "页面定位信息")
    .replace(/CTA/gi, "关键操作入口")
    .replace(/接口日志/g, "服务记录")
    .replace(/接口/g, "服务")
    .replace(/请求/g, "服务反馈")
    .replace(/网络/g, "服务连接")
    .replace(/token/gi, "访问凭证")
    .replace(/appKey/gi, "应用标识")
    .replace(/代码/g, "接入配置")
    .replace(/click/gi, "点击")
    .replace(/button/gi, "按钮")
    .replace(/前端/g, "页面体验")
    .replace(/UI/g, "界面")
    .replace(/DOM/g, "页面结构")
    .replace(/url/gi, "地址")
    .replace(/https?:\/\/\S+/g, "相关服务")
    .replace(/\s+/g, " ")
    .trim();
}
