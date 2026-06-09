import { JourneyResultStatus, Prisma } from "@prisma/client";

import {
  buildApplicationRuleContext,
  toBusinessLanguage,
  type ApplicationRuleContext,
  type ApplicationRuleMatch,
  type ApplicationRuleSignal,
} from "@/lib/agent1-agent2-rules";
import { prisma } from "@/lib/prisma";

export const agent2ModelVersion = "agent2-rules-v1";

export type JourneyForAgent2 = Prisma.JourneyGetPayload<{
  include: {
    application: true;
    user: {
      include: {
        userTags: {
          include: {
            tag: true;
          };
        };
      };
    };
    journeyTags: {
      include: {
        tag: true;
      };
    };
    events: true;
    evidences: {
      include: {
        journeyEvent: true;
      };
    };
    browserEvents: true;
  };
}>;

export type ApplicationAiProfileForAgent2 = Prisma.ApplicationAiProfileGetPayload<Record<string, never>>;

export type Agent2OutcomeStatus = "success" | "failed" | "unfinished" | "unknown";
export type Agent2Severity = "info" | "warning" | "critical";

export type Agent2KeyStage = {
  key: string;
  title: string;
  description: string;
  offsetMs: number;
  eventIds: string[];
  evidenceIds: string[];
  confidence: number;
};

export type Agent2Blocker = {
  key: string;
  title: string;
  description: string;
  severity: Agent2Severity;
  eventIds: string[];
  evidenceIds: string[];
  offsetMs?: number;
};

export type Agent2Anomaly = {
  key: string;
  title: string;
  description: string;
  severity: Agent2Severity;
  eventIds: string[];
  evidenceIds: string[];
  offsetMs?: number;
};

export type Agent2Evidence = {
  id: string;
  type: "event" | "evidence" | "request" | "agent1_rule";
  title: string;
  description: string;
  source: string;
  eventId?: string;
  evidenceId?: string;
  offsetMs?: number;
};

export type Agent2ProductInsight = {
  key: string;
  title: string;
  description: string;
  impact: "low" | "medium" | "high";
  recommendation: string;
};

export type Agent2RuleContext = ApplicationRuleContext;
export type Agent2RuleItem = ApplicationRuleSignal;
export type Agent2RuleMatch = ApplicationRuleMatch<ApplicationRuleSignal>;

export type Agent2JourneyAnalysisOutput = {
  journeyGoal: string;
  goalConfidence: number;
  processSummary: string;
  keyStages: Agent2KeyStage[];
  outcome: {
    status: Agent2OutcomeStatus;
    reason: string;
    confidence: number;
  };
  blockers: Agent2Blocker[];
  anomalies: Agent2Anomaly[];
  evidence: Agent2Evidence[];
  productInsights: Agent2ProductInsight[];
  agent1Rules?: Agent2RuleContext;
};

export type JourneyAiAnalysisViewModel = Agent2JourneyAnalysisOutput & {
  id: string;
  generatedAt: Date;
  modelVersion: string;
};

export type JourneyAiAnalysisRecord = {
  id: string;
  journeyId: string;
  goal: string;
  goalConfidence: number;
  processSummary: string;
  outcomeStatus: string;
  outcomeReason: string;
  outcomeConfidence: number;
  keyStagesJson: Prisma.JsonValue;
  blockersJson: Prisma.JsonValue;
  anomaliesJson: Prisma.JsonValue;
  evidenceJson: Prisma.JsonValue;
  insightsJson: Prisma.JsonValue;
  agent1RulesJson: Prisma.JsonValue | null;
  generatedAt: Date;
  modelVersion: string;
};

function asArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject<T extends Record<string, unknown>>(value: Prisma.JsonValue | null | undefined): T | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : undefined;
}

function clampConfidence(value: number) {
  return Math.max(0.1, Math.min(0.99, Number(value.toFixed(2))));
}

function compactText(items: Array<string | null | undefined>) {
  return items
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item))
    .join(" ");
}

function includesAny(value: string, keywords: string[]) {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function stableKey(prefix: string, index: number) {
  return `${prefix}_${String(index + 1).padStart(2, "0")}`;
}

function sanitizeEvidenceType(type: Agent2Evidence["type"]): Agent2Evidence["type"] {
  return type;
}

function sanitizeStage(stage: Agent2KeyStage): Agent2KeyStage {
  return {
    ...stage,
    title: toBusinessLanguage(stage.title),
    description: toBusinessLanguage(stage.description),
  };
}

function sanitizeBlocker(blocker: Agent2Blocker): Agent2Blocker {
  return {
    ...blocker,
    title: toBusinessLanguage(blocker.title),
    description: toBusinessLanguage(blocker.description),
  };
}

function sanitizeAnomaly(anomaly: Agent2Anomaly): Agent2Anomaly {
  return {
    ...anomaly,
    title: toBusinessLanguage(anomaly.title),
    description: toBusinessLanguage(anomaly.description),
  };
}

function sanitizeEvidence(evidence: Agent2Evidence): Agent2Evidence {
  return {
    ...evidence,
    type: sanitizeEvidenceType(evidence.type),
    title: toBusinessLanguage(evidence.title),
    description: toBusinessLanguage(evidence.description),
    source: toBusinessLanguage(evidence.source),
  };
}

function sanitizeInsight(insight: Agent2ProductInsight): Agent2ProductInsight {
  return {
    ...insight,
    title: toBusinessLanguage(insight.title),
    description: toBusinessLanguage(insight.description),
    recommendation: toBusinessLanguage(insight.recommendation),
  };
}

export function sanitizeJourneyAiAnalysisOutput(output: Agent2JourneyAnalysisOutput): Agent2JourneyAnalysisOutput {
  return {
    ...output,
    journeyGoal: toBusinessLanguage(output.journeyGoal),
    processSummary: toBusinessLanguage(output.processSummary),
    keyStages: output.keyStages.map(sanitizeStage),
    outcome: {
      ...output.outcome,
      reason: toBusinessLanguage(output.outcome.reason),
    },
    blockers: output.blockers.map(sanitizeBlocker),
    anomalies: output.anomalies.map(sanitizeAnomaly),
    evidence: output.evidence.map(sanitizeEvidence),
    productInsights: output.productInsights.map(sanitizeInsight),
  };
}

function outcomeStatus(status: JourneyResultStatus): Agent2OutcomeStatus {
  if (status === JourneyResultStatus.COMPLETED) return "success";
  if (status === JourneyResultStatus.FAILED) return "failed";
  if (status === JourneyResultStatus.ABANDONED) return "unfinished";
  return "unknown";
}

function outcomeLabel(status: Agent2OutcomeStatus) {
  const labels: Record<Agent2OutcomeStatus, string> = {
    success: "目标已达成",
    failed: "目标被异常阻断",
    unfinished: "目标未完成",
    unknown: "目标不明确",
  };
  return labels[status];
}

function severityFromEvidence(severity: string): Agent2Severity {
  if (severity === "CRITICAL") return "critical";
  if (severity === "WARNING") return "warning";
  return "info";
}

function isRequestFailure(event: JourneyForAgent2["events"][number]) {
  return event.type === "REQUEST" && (event.statusCode ?? 0) >= 400;
}

function isSlowRequest(event: JourneyForAgent2["events"][number]) {
  return event.type === "REQUEST" && (event.durationMs ?? 0) >= 1800;
}

function isErrorFeedback(event: JourneyForAgent2["events"][number]) {
  return event.isAnomaly || includesAny(compactText([event.uiFeedback, event.title, event.description]), ["error", "fail", "失败", "错误", "异常", "toast", "dialog"]);
}

function inferGoal(journey: JourneyForAgent2, agent1Rules: Agent2RuleContext) {
  const matchedIntent = agent1Rules.matchedBusinessIntents[0];
  const matchedJourney = agent1Rules.matchedBusinessJourneys[0];
  if (matchedIntent?.label) {
    return {
      goal: matchedIntent.label,
      confidence: agent1Rules.hasProfile ? 0.86 : 0.62,
    };
  }
  if (matchedJourney?.goal || matchedJourney?.name) {
    return {
      goal: matchedJourney.goal ?? matchedJourney.name ?? "完成核心业务旅程",
      confidence: 0.84,
    };
  }

  const eventActions = journey.events
    .map((event) => event.businessAction ?? event.businessIntent ?? event.uiAction ?? event.targetLabel)
    .filter((value): value is string => Boolean(value));
  const actionCorpus = compactText([journey.businessActionType, ...eventActions, journey.pageTitle, journey.pageTemplate]);
  const normalized = actionCorpus.toLowerCase();

  if (includesAny(normalized, ["checkout", "purchase", "pay", "结算", "支付", "下单"])) {
    return {
      goal: "完成购物车结算或下单流程",
      confidence: 0.86,
    };
  }
  if (includesAny(normalized, ["add_to_cart", "add to cart", "加入购物车", "购物车"])) {
    return {
      goal: "将目标商品加入购物车并继续推进购买决策",
      confidence: 0.82,
    };
  }
  if (includesAny(normalized, ["submit", "form", "提交", "报名", "预约", "确认"])) {
    return {
      goal: "提交当前页面中的核心表单或确认动作",
      confidence: 0.8,
    };
  }
  if (journey.keyActionCount > 0 && journey.businessActionType && !includesAny(journey.businessActionType, ["浏览与交互", "目标完成"])) {
    return {
      goal: `完成“${journey.businessActionType}”相关操作`,
      confidence: 0.72,
    };
  }
  if (journey.resultStatus === JourneyResultStatus.BROWSING) {
    return {
      goal: `浏览 ${journey.pageTitle || journey.pageTemplate} 并评估是否继续操作`,
      confidence: agent1Rules.hasProfile ? 0.55 : 0.45,
    };
  }
  return {
    goal: `围绕 ${journey.pageTitle || journey.pageTemplate} 完成一次业务访问`,
    confidence: agent1Rules.hasProfile ? 0.62 : 0.52,
  };
}

function buildKeyStages(journey: JourneyForAgent2): Agent2KeyStage[] {
  const candidates = journey.events.filter((event, index) => {
    if (index === 0) return true;
    if (event.isKeyEvent || event.isAnomaly) return true;
    if (event.type === "PAGE_VIEW" || event.type === "BUSINESS_ACTION" || event.type === "REGION_ACTION") return true;
    return isRequestFailure(event) || isSlowRequest(event);
  });

  const deduped: JourneyForAgent2["events"] = [];
  const seen = new Set<string>();
  for (const event of candidates) {
    const signature = `${event.type}:${event.title}:${event.offsetMs}`;
    if (!seen.has(signature)) {
      deduped.push(event);
      seen.add(signature);
    }
  }

  const selected = deduped.slice(0, 5);
  if (!selected.length) {
    return [
      {
        key: "stage_01",
        title: "旅程已生成",
        description: "当前旅程缺少可解释的关键行为，建议检查目标应用是否已记录浏览、操作、提交、服务反馈和错误反馈。",
        offsetMs: 0,
        eventIds: [],
        evidenceIds: [],
        confidence: 0.35,
      },
    ];
  }

  return selected.map((event, index) => ({
    key: stableKey("stage", index),
    title: event.title,
    description: compactText([
      event.description,
      event.region ? `业务区域：${event.region}` : null,
      event.businessAction ? `业务动作：${event.businessAction}` : null,
      event.statusCode ? "服务反馈出现异常" : null,
    ]),
    offsetMs: event.offsetMs,
    eventIds: [event.id],
    evidenceIds: journey.evidences.filter((evidence) => evidence.journeyEventId === event.id).map((evidence) => evidence.id),
    confidence: event.isAnomaly ? 0.88 : event.isKeyEvent ? 0.78 : 0.65,
  }));
}

function buildEvidence(journey: JourneyForAgent2): Agent2Evidence[] {
  const evidenceItems: Agent2Evidence[] = journey.evidences.slice(0, 8).map((evidence) => ({
    id: `evidence:${evidence.id}`,
    type: "evidence",
    title: evidence.title,
    description: evidence.description,
    source: evidence.type,
    eventId: evidence.journeyEventId ?? undefined,
    evidenceId: evidence.id,
    offsetMs: evidence.offsetMs,
  }));

  const eventEvidence = journey.events
    .filter((event) => event.isAnomaly || isRequestFailure(event) || isSlowRequest(event))
    .slice(0, 8)
    .map((event): Agent2Evidence => ({
      id: `event:${event.id}`,
      type: event.type === "REQUEST" ? "request" : "event",
      title: event.title,
      description: compactText([
        event.description,
        event.requestUrl,
        event.statusCode ? `HTTP ${event.statusCode}` : null,
        event.durationMs ? `${event.durationMs}ms` : null,
      ]),
      source: event.type,
      eventId: event.id,
      offsetMs: event.offsetMs,
    }));

  const merged = [...evidenceItems, ...eventEvidence];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.evidenceId ?? item.eventId ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildBlockers(journey: JourneyForAgent2): Agent2Blocker[] {
  const blockers: Agent2Blocker[] = [];

  journey.events.filter(isRequestFailure).slice(0, 4).forEach((event, index) => {
    blockers.push({
      key: stableKey("failed_request", index),
      title: `服务异常：${event.businessAction ?? event.requestOutcome ?? "关键服务未成功完成"}`,
      description: `服务返回异常，可能直接影响用户完成目标。${event.durationMs ? "等待时间也偏长。" : ""}`,
      severity: (event.statusCode ?? 0) >= 500 ? "critical" : "warning",
      eventIds: [event.id],
      evidenceIds: journey.evidences.filter((evidence) => evidence.journeyEventId === event.id).map((evidence) => evidence.id),
      offsetMs: event.offsetMs,
    });
  });

  journey.events.filter((event) => isSlowRequest(event) && !isRequestFailure(event)).slice(0, 3).forEach((event, index) => {
    blockers.push({
      key: stableKey("slow_request", index),
      title: `等待时间过长：${event.businessAction ?? event.requestOutcome ?? "关键服务反馈较慢"}`,
      description: "关键服务等待时间明显偏长，可能造成等待、犹豫或重复操作。",
      severity: "warning",
      eventIds: [event.id],
      evidenceIds: journey.evidences.filter((evidence) => evidence.journeyEventId === event.id).map((evidence) => evidence.id),
      offsetMs: event.offsetMs,
    });
  });

  journey.events.filter((event) => event.type === "ANOMALY" || isErrorFeedback(event)).slice(0, 3).forEach((event, index) => {
    if (blockers.some((blocker) => blocker.eventIds.includes(event.id))) return;
    blockers.push({
      key: stableKey("ui_error", index),
      title: event.title || "页面异常反馈",
      description: compactText([event.description, event.uiFeedback ? `界面反馈：${event.uiFeedback}` : null]),
      severity: event.isAnomaly ? "critical" : "warning",
      eventIds: [event.id],
      evidenceIds: journey.evidences.filter((evidence) => evidence.journeyEventId === event.id).map((evidence) => evidence.id),
      offsetMs: event.offsetMs,
    });
  });

  if (journey.resultStatus === JourneyResultStatus.ABANDONED && blockers.length === 0) {
    blockers.push({
      key: "unfinished_without_completion",
      title: "未观察到完成动作",
      description: "旅程中出现了交互，但没有出现提交、确认或完成类信号，可能在决策或操作路径中断。",
      severity: "warning",
      eventIds: journey.events.slice(-1).map((event) => event.id),
      evidenceIds: [],
      offsetMs: journey.events.at(-1)?.offsetMs,
    });
  }

  if (journey.resultStatus === JourneyResultStatus.BROWSING && blockers.length === 0) {
    blockers.push({
      key: "browse_only_no_action",
      title: "仅浏览未触发关键动作",
      description: "旅程只有浏览行为，未观察到点击、提交或其他关键业务动作，无法确认用户是否理解下一步入口。",
      severity: "info",
      eventIds: journey.events.slice(0, 1).map((event) => event.id),
      evidenceIds: [],
      offsetMs: journey.events[0]?.offsetMs ?? 0,
    });
  }

  return blockers.slice(0, 6);
}

function buildAnomalies(journey: JourneyForAgent2, blockers: Agent2Blocker[]): Agent2Anomaly[] {
  const fromBlockers = blockers
    .filter((blocker) => blocker.severity !== "info")
    .map((blocker, index): Agent2Anomaly => ({
      key: stableKey("blocker_anomaly", index),
      title: blocker.title,
      description: blocker.description,
      severity: blocker.severity,
      eventIds: blocker.eventIds,
      evidenceIds: blocker.evidenceIds,
      offsetMs: blocker.offsetMs,
    }));

  const fromEvidence = journey.evidences
    .filter((evidence) => evidence.severity !== "INFO")
    .slice(0, 4)
    .map((evidence, index): Agent2Anomaly => ({
      key: stableKey("evidence_anomaly", index),
      title: evidence.title,
      description: evidence.description,
      severity: severityFromEvidence(evidence.severity),
      eventIds: evidence.journeyEventId ? [evidence.journeyEventId] : [],
      evidenceIds: [evidence.id],
      offsetMs: evidence.offsetMs,
    }));

  const merged = [...fromBlockers, ...fromEvidence];
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = [...item.eventIds, ...item.evidenceIds].join(":") || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function buildOutcome(
  journey: JourneyForAgent2,
  blockers: Agent2Blocker[],
  agent1Rules: Agent2RuleContext,
) {
  const status = outcomeStatus(journey.resultStatus);
  const criticalBlockerCount = blockers.filter((blocker) => blocker.severity === "critical").length;
  const matchedFailureCount = agent1Rules.matchedFailureRules.length;
  const matchedSuccessCount = agent1Rules.matchedSuccessRules.length;
  let resolvedStatus = status;
  let confidence = agent1Rules.hasProfile ? 0.68 : 0.56;

  if (matchedFailureCount > 0 && status !== "success") {
    resolvedStatus = "failed";
  }
  if (matchedSuccessCount > 0 && criticalBlockerCount === 0 && status !== "failed") {
    resolvedStatus = "success";
  }

  if (resolvedStatus === "success") {
    confidence = matchedSuccessCount > 0 ? 0.88 : 0.78;
    if (criticalBlockerCount > 0 || matchedFailureCount > 0) confidence -= 0.18;
  } else if (resolvedStatus === "failed") {
    confidence = criticalBlockerCount > 0 || matchedFailureCount > 0 ? 0.9 : 0.78;
  } else if (resolvedStatus === "unfinished") {
    confidence = blockers.length > 0 ? 0.76 : agent1Rules.hasProfile ? 0.66 : 0.56;
  } else {
    confidence = journey.keyActionCount === 0 ? 0.64 : 0.52;
  }

  const reasonMap: Record<Agent2OutcomeStatus, string> = {
    success:
      matchedSuccessCount > 0
        ? "当前旅程符合应用级成功定义，用户目标可判断为已达成。"
        : "旅程状态为已完成，并观察到关键业务动作或完成类信号。",
    failed:
      matchedFailureCount > 0
        ? "当前旅程符合应用级失败定义，用户目标大概率被阻断。"
        : criticalBlockerCount > 0
          ? "旅程中存在关键异常反馈，目标大概率被阻断。"
          : "旅程状态为异常，需要结合证据区定位阻断点。",
    unfinished: "旅程出现交互但没有观察到完成类信号，目标大概率未完成。",
    unknown: agent1Rules.hasProfile
      ? "旅程以浏览为主，未命中应用级成功或失败定义，目标是否达成仍不明确。"
      : "未找到应用级规则，且旅程以浏览为主，目标是否达成仍不明确。",
  };

  return {
    status: resolvedStatus,
    reason: reasonMap[resolvedStatus],
    confidence: clampConfidence(confidence),
  };
}

function buildProcessSummary(params: {
  journey: JourneyForAgent2;
  goal: string;
  outcome: Agent2JourneyAnalysisOutput["outcome"];
  keyStages: Agent2KeyStage[];
  blockers: Agent2Blocker[];
}) {
  const stageText = params.keyStages
    .slice(0, 3)
    .map((stage) => stage.title)
    .join(" -> ");
  const blockerText = params.blockers.length
    ? `主要阻塞点是${params.blockers[0].title}。`
    : "未发现明确阻塞点。";

  return `用户大概率想要${params.goal}。过程可概括为：${stageText || "缺少足够关键事件"}。最终判断为${outcomeLabel(params.outcome.status)}，${blockerText}`;
}

function buildProductInsights(
  journey: JourneyForAgent2,
  outcome: Agent2JourneyAnalysisOutput["outcome"],
  blockers: Agent2Blocker[],
  agent1Rules: Agent2RuleContext,
): Agent2ProductInsight[] {
  const insights: Agent2ProductInsight[] = [];

  if (!agent1Rules.hasProfile) {
    insights.push({
      key: "missing_application_rules",
      title: "缺少应用级业务规则",
      description: "当前分析没有可引用的应用结构理解结果，目标和达成判断主要来自通用行为模式。",
      impact: "medium",
      recommendation: "先在应用详情页执行“AI 理解应用”，生成核心业务旅程、成功定义和失败定义后，再重新生成本旅程总结。",
    });
  }

  if (outcome.status === "failed") {
    insights.push({
      key: "fix_blocking_error",
      title: "优先排查直接阻断点",
      description: blockers[0]?.title ?? "旅程存在异常结果，但缺少可定位的错误证据。",
      impact: "high",
      recommendation: "先排查导致用户停下来的异常反馈和服务记录，再复测同一业务路径。",
    });
  }

  if (outcome.status === "unfinished") {
    insights.push({
      key: "improve_completion_guidance",
      title: "补强完成动作前的引导与反馈",
      description: "用户发生了交互但未完成目标，说明路径中可能存在理解成本、等待成本或反馈不足。",
      impact: "medium",
      recommendation: "检查关键操作入口是否足够清晰、操作后的状态反馈是否明确，以及是否需要增加下一步提示。",
    });
  }

  if (outcome.status === "unknown") {
    insights.push({
      key: "clarify_entry_value",
      title: "提升首屏价值和下一步入口识别度",
      description: "旅程只有浏览行为，平台无法判断用户是否找到下一步动作。",
      impact: "medium",
      recommendation: "为关键操作入口补充清晰的业务含义记录，帮助后续分析判断用户真实意图。",
    });
  }

  if (outcome.status === "success") {
    insights.push({
      key: "baseline_success_path",
      title: "可作为成功路径基准样本",
      description: "该旅程具备较完整的目标达成信号，可用于对比异常或未完成旅程。",
      impact: "low",
      recommendation: "将该旅程加入相关研究项目，和失败/未完成样本进行路径差异对照。",
    });
  }

  const missingRegionCount = journey.events.filter((event) => !event.region && event.type !== "REQUEST").length;
  if (missingRegionCount > 0) {
    insights.push({
      key: "enhance_region_semantics",
      title: "补充业务区域语义可提升后续分析质量",
      description: `${missingRegionCount} 个用户动作缺少明确业务区域，后续分析会更依赖文本猜测。`,
      impact: "medium",
      recommendation: "按应用结构理解结果补充关键区域和核心操作的业务语义标记。",
    });
  }

  if (agent1Rules.matchedFailureRules.length > 0) {
    insights.push({
      key: "agent1_failure_rule_matched",
      title: "命中应用级失败规则",
      description: `当前旅程命中了 ${agent1Rules.matchedFailureRules.length} 条应用级失败定义，适合作为产品风险样本。`,
      impact: "high",
      recommendation: "将该旅程归档到研究项目，并在规则层继续观察同类路径是否重复发生。",
    });
  }

  return insights.slice(0, 5);
}

export function buildJourneyAiAnalysisOutput(
  journey: JourneyForAgent2,
  profile: ApplicationAiProfileForAgent2 | null,
): Agent2JourneyAnalysisOutput {
  const agent1Rules = buildApplicationRuleContext(profile, journey);
  const { goal, confidence } = inferGoal(journey, agent1Rules);
  const keyStages = buildKeyStages(journey);
  const blockers = buildBlockers(journey);
  const outcome = buildOutcome(journey, blockers, agent1Rules);
  const anomalies = buildAnomalies(journey, blockers);
  const evidence = buildEvidence(journey);
  const processSummary = buildProcessSummary({
    journey,
    goal,
    outcome,
    keyStages,
    blockers,
  });
  const productInsights = buildProductInsights(journey, outcome, blockers, agent1Rules);

  return sanitizeJourneyAiAnalysisOutput({
    journeyGoal: goal,
    goalConfidence: clampConfidence(confidence),
    processSummary,
    keyStages,
    outcome,
    blockers,
    anomalies,
    evidence,
    productInsights,
    agent1Rules,
  });
}

export function toJourneyAiAnalysisViewModel(analysis: JourneyAiAnalysisRecord | null | undefined): JourneyAiAnalysisViewModel | null {
  if (!analysis) return null;

  return {
    id: analysis.id,
    generatedAt: analysis.generatedAt,
    modelVersion: analysis.modelVersion,
    journeyGoal: analysis.goal,
    goalConfidence: analysis.goalConfidence,
    processSummary: analysis.processSummary,
    keyStages: asArray<Agent2KeyStage>(analysis.keyStagesJson),
    outcome: {
      status: ["success", "failed", "unfinished", "unknown"].includes(analysis.outcomeStatus)
        ? (analysis.outcomeStatus as Agent2OutcomeStatus)
        : "unknown",
      reason: analysis.outcomeReason,
      confidence: analysis.outcomeConfidence,
    },
    blockers: asArray<Agent2Blocker>(analysis.blockersJson),
    anomalies: asArray<Agent2Anomaly>(analysis.anomaliesJson),
    evidence: asArray<Agent2Evidence>(analysis.evidenceJson),
    productInsights: asArray<Agent2ProductInsight>(analysis.insightsJson),
    agent1Rules: asObject<Agent2RuleContext>(analysis.agent1RulesJson),
  };
}

export function buildJourneyAiListSummary(analysis: JourneyAiAnalysisRecord | null | undefined, fallback: string) {
  const viewModel = toJourneyAiAnalysisViewModel(analysis);
  if (!viewModel) return fallback;

  const outcome = outcomeLabel(viewModel.outcome.status);
  const blocker = viewModel.blockers[0] ? `关键阻塞：${viewModel.blockers[0].title}` : "未发现明确阻塞点";
  return toBusinessLanguage(`${viewModel.journeyGoal}，${outcome}。${blocker}。`);
}

export async function ensureJourneyAiAnalysis(journeyId: string, options: { regenerate?: boolean } = {}) {
  if (!options.regenerate) {
    const existing = await prisma.journeyAiAnalysis.findFirst({
      where: { journeyId },
      orderBy: { generatedAt: "desc" },
    });
    if (existing) {
      return existing;
    }
  }

  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
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
    return null;
  }

  const profile = await prisma.applicationAiProfile.findFirst({
    where: {
      tenantId: journey.tenantId,
      applicationId: journey.applicationId,
    },
    orderBy: { generatedAt: "desc" },
  });

  const output = buildJourneyAiAnalysisOutput(journey, profile);

  return prisma.journeyAiAnalysis.create({
    data: {
      tenantId: journey.tenantId,
      applicationId: journey.applicationId,
      journeyId: journey.id,
      goal: output.journeyGoal,
      goalConfidence: output.goalConfidence,
      processSummary: output.processSummary,
      outcomeStatus: output.outcome.status,
      outcomeReason: output.outcome.reason,
      outcomeConfidence: output.outcome.confidence,
      keyStagesJson: output.keyStages as unknown as Prisma.InputJsonValue,
      blockersJson: output.blockers as unknown as Prisma.InputJsonValue,
      anomaliesJson: output.anomalies as unknown as Prisma.InputJsonValue,
      evidenceJson: output.evidence as unknown as Prisma.InputJsonValue,
      insightsJson: output.productInsights as unknown as Prisma.InputJsonValue,
      agent1RulesJson: output.agent1Rules ? (output.agent1Rules as unknown as Prisma.InputJsonValue) : undefined,
      modelVersion: agent2ModelVersion,
      generatedAt: new Date(),
    },
  });
}
