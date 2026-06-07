import {
  EvidenceSeverity,
  EvidenceType,
  JourneyEventType,
  JourneyResultStatus,
  JourneySource,
  Prisma,
  TagSource,
  TagType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

const defaultInactivityTimeoutMs = 30 * 60 * 1000;
const aggregationVersion = "browser-events-v1";
const maxEventsPerRun = 500;

type BrowserEventForAggregation = Prisma.BrowserEventGetPayload<{
  include: {
    application: true;
    tenant: true;
  };
}>;

type JourneyCandidate = {
  tenantId: string;
  applicationId: string;
  sessionId: string;
  events: BrowserEventForAggregation[];
};

type AggregationResult = {
  createdJourneys: number;
  linkedEvents: number;
};

function stableCodePart(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, "").slice(-8).toUpperCase() || "UNKNOWN";
}

function getExternalUserId(events: BrowserEventForAggregation[]) {
  const identified = events.find((event) => event.userId?.trim());
  if (identified?.userId) {
    return identified.userId;
  }
  const anonymous = events.find((event) => event.anonymousId?.trim());
  return anonymous?.anonymousId ?? `anonymous_${events[0]?.sessionId ?? "unknown"}`;
}

function inferDevice(context: Prisma.JsonValue | null) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return "Browser";
  }
  const userAgent = typeof context.userAgent === "string" ? context.userAgent : "";
  if (/iphone|android|mobile/i.test(userAgent)) {
    return "Mobile Web";
  }
  return "Desktop";
}

function inferOs(context: Prisma.JsonValue | null) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return "Unknown OS";
  }
  const userAgent = typeof context.userAgent === "string" ? context.userAgent : "";
  if (/mac os|macintosh/i.test(userAgent)) return "macOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/iphone|ipad|ios/i.test(userAgent)) return "iOS";
  if (/android/i.test(userAgent)) return "Android";
  return "Unknown OS";
}

function inferBrowser(context: Prisma.JsonValue | null) {
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return "Browser";
  }
  const userAgent = typeof context.userAgent === "string" ? context.userAgent : "";
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent)) return "Safari";
  if (/firefox/i.test(userAgent)) return "Firefox";
  return "Browser";
}

function splitByInactivity(events: BrowserEventForAggregation[], timeoutMs: number) {
  const sortedEvents = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const groups: BrowserEventForAggregation[][] = [];
  let currentGroup: BrowserEventForAggregation[] = [];

  for (const event of sortedEvents) {
    const previous = currentGroup[currentGroup.length - 1];
    if (previous && event.timestamp.getTime() - previous.timestamp.getTime() > timeoutMs) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(event);
  }

  if (currentGroup.length) {
    groups.push(currentGroup);
  }

  return groups;
}

function calculateEffectiveDuration(events: BrowserEventForAggregation[], timeoutMs: number) {
  if (events.length <= 1) {
    return 1000;
  }

  let duration = 0;
  for (let index = 1; index < events.length; index += 1) {
    const gap = events[index].timestamp.getTime() - events[index - 1].timestamp.getTime();
    duration += Math.min(Math.max(gap, 0), timeoutMs);
  }
  return Math.max(duration, 1000);
}

function isFailureEvent(event: BrowserEventForAggregation) {
  return event.eventType === "ui_error" || (event.eventType === "network_request" && (event.requestStatus ?? 0) >= 400);
}

function jsonField(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : value;
}

function readContextRecord(event: BrowserEventForAggregation) {
  if (!event.context || typeof event.context !== "object" || Array.isArray(event.context)) {
    return null;
  }
  return event.context as Record<string, Prisma.JsonValue>;
}

function readContextString(event: BrowserEventForAggregation, key: string) {
  const context = readContextRecord(event);
  const value = context?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeActionLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const knownLabels: Record<string, string> = {
    identify: "绑定用户身份",
    integration_verify_clicked: "验证接入",
    product_add_to_cart: "加入购物车",
    product_add_to_cart_keyboard: "键盘加入购物车",
    cart_opened: "打开购物车",
    cart_closed: "关闭购物车",
    cart_item_removed: "移除购物车商品",
    cart_item_quantity_increased: "增加商品数量",
    cart_item_quantity_decreased: "减少商品数量",
    checkout_clicked: "点击结算",
    checkout_clicked_empty_cart: "空购物车结算",
  };
  const normalized = value.trim().toLowerCase();

  return knownLabels[normalized] ?? value.replace(/[_-]+/g, " ");
}

function inferUiAction(event: BrowserEventForAggregation) {
  if (event.action) {
    return event.action;
  }
  const eventName = readContextString(event, "eventName");
  if (eventName) {
    return eventName;
  }
  if (event.eventType === "ui_click") {
    return "click";
  }
  if (event.eventType === "form_submit") {
    return "submit";
  }
  return null;
}

function inferBusinessAction(event: BrowserEventForAggregation) {
  return event.businessAction ?? normalizeActionLabel(readContextString(event, "eventName")) ?? null;
}

function inferTargetLabel(event: BrowserEventForAggregation) {
  if (event.targetLabel) {
    return event.targetLabel;
  }

  const context = readContextRecord(event);
  const target = context?.target && typeof context.target === "object" && !Array.isArray(context.target) ? (context.target as Record<string, Prisma.JsonValue>) : null;
  const candidates = [target?.ariaLabel, target?.text, target?.name, target?.id];
  const label = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return label?.trim() ?? null;
}

function inferRegionSource(event: BrowserEventForAggregation) {
  if (event.regionSource) {
    return event.regionSource;
  }
  if (event.region) {
    return "sdk";
  }
  if (event.aiRegionStatus === "PENDING") {
    return "pending_ai";
  }
  return null;
}

function getEventSemantic(event: BrowserEventForAggregation) {
  const uiAction = inferUiAction(event);
  const businessAction = inferBusinessAction(event);

  return {
    region: event.region,
    regionSource: inferRegionSource(event),
    regionConfidence: event.regionConfidence,
    uiAction,
    actionType: event.actionType,
    businessAction,
    businessIntent: event.businessIntent,
    targetLabel: inferTargetLabel(event),
  };
}

function getPrimaryBusinessAction(events: BrowserEventForAggregation[], resultStatus: JourneyResultStatus) {
  const actions = events
    .map((event) => event.businessAction ?? normalizeActionLabel(readContextString(event, "eventName")))
    .filter((value): value is string => Boolean(value));

  if (actions.length) {
    return actions[actions.length - 1];
  }

  return resultStatus === JourneyResultStatus.COMPLETED ? "目标完成" : "浏览与交互";
}

function inferJourneyStatus(events: BrowserEventForAggregation[]) {
  const hasFailure = events.some(isFailureEvent);
  if (hasFailure) {
    return JourneyResultStatus.FAILED;
  }

  const hasManualCompletion = events.some((event) => {
    if (!event.context || typeof event.context !== "object" || Array.isArray(event.context)) {
      return false;
    }
    const eventName = typeof event.context.eventName === "string" ? event.context.eventName.toLowerCase() : "";
    return /complete|success|submit|checkout|purchase|add_to_cart|confirm|finish/.test(eventName);
  });
  const hasSubmit = events.some((event) => event.eventType === "form_submit");
  if (hasManualCompletion || hasSubmit) {
    return JourneyResultStatus.COMPLETED;
  }

  const pageViewCount = events.filter((event) => event.eventType === "page_view").length;
  const actionCount = events.filter((event) => event.eventType === "ui_click" || event.eventType === "form_submit").length;
  if (pageViewCount > 0 && actionCount === 0) {
    return JourneyResultStatus.BROWSING;
  }

  return JourneyResultStatus.ABANDONED;
}

function toJourneyEventType(event: BrowserEventForAggregation) {
  if (event.eventType === "page_view") return JourneyEventType.PAGE_VIEW;
  if (event.eventType === "network_request") return JourneyEventType.REQUEST;
  if (event.eventType === "form_submit") return JourneyEventType.BUSINESS_ACTION;
  if (event.eventType === "ui_error") return JourneyEventType.ANOMALY;
  return JourneyEventType.REGION_ACTION;
}

function getEventTitle(event: BrowserEventForAggregation) {
  if (event.eventType === "page_view") return `进入页面：${event.pageTitle || event.pagePath || event.pageHost || "未知页面"}`;
  const semantic = getEventSemantic(event);
  if (event.eventType === "ui_click") return semantic.businessAction || semantic.targetLabel || "点击页面元素";
  if (event.eventType === "form_submit") return semantic.businessAction || "提交表单";
  if (event.eventType === "network_request") return `请求 ${event.requestMethod ?? "GET"} ${event.requestHost ?? ""}`;
  if (event.eventType === "ui_error") return "页面错误";
  return event.eventType;
}

function getEventDescription(event: BrowserEventForAggregation) {
  const semantic = getEventSemantic(event);
  if (event.eventType === "page_view") {
    return `用户浏览 ${event.pageTitle || event.pageUrl || "页面"}。`;
  }
  if (event.eventType === "network_request") {
    return `浏览器发起 ${event.requestMethod ?? "GET"} 请求，状态码 ${event.requestStatus ?? "-"}，耗时 ${event.requestDuration ?? "-"}ms。`;
  }
  if (event.eventType === "ui_error") {
    return "浏览器捕获到错误或未处理 Promise 异常。";
  }
  if (event.eventType === "form_submit") {
    return semantic.region
      ? `用户在${semantic.region}提交表单，可能代表业务目标推进。`
      : "用户提交了表单，可能代表业务目标推进。";
  }
  if (semantic.region || semantic.targetLabel || semantic.businessAction) {
    return `用户${semantic.businessAction ? `执行“${semantic.businessAction}”` : "触发页面交互"}${semantic.region ? `，区域为${semantic.region}` : ""}${semantic.targetLabel ? `，目标为${semantic.targetLabel}` : ""}。`;
  }
  return "用户触发了页面交互动作，region 仍待 AI 解构。";
}

function buildJourneySummary(params: {
  applicationName: string;
  externalUserId: string;
  pageTitle: string;
  resultStatus: JourneyResultStatus;
  hasAnomaly: boolean;
  pageCount: number;
  keyActionCount: number;
  requestCount: number;
}) {
  const statusLabelMap: Record<JourneyResultStatus, string> = {
    COMPLETED: "已完成",
    FAILED: "异常失败",
    ABANDONED: "未完成",
    BROWSING: "仅浏览退出",
  };
  const statusLabel = statusLabelMap[params.resultStatus];
  const summary = `${params.externalUserId} 在 ${params.applicationName} 访问 ${params.pageTitle}，产生 ${params.pageCount} 次页面浏览、${params.keyActionCount} 个关键动作和 ${params.requestCount} 次请求，最终状态为${statusLabel}。`;

  return {
    aiSummaryShort: summary,
    aiScenarioSummary: `该旅程来自真实浏览器事件聚合，用户围绕 ${params.pageTitle} 展开浏览和操作。`,
    aiProcessSummary: `系统按 sessionId 和 30 分钟无活动切分规则聚合事件，形成页面浏览、交互、表单、请求和错误时间线。`,
    aiGoalAnalysis:
      params.resultStatus === "COMPLETED"
        ? "旅程中出现表单提交或明确业务完成动作，初步判断目标已达成。"
        : params.resultStatus === "BROWSING"
          ? "旅程仅包含页面浏览，未观察到关键交互或目标动作。"
          : params.resultStatus === "FAILED"
            ? "旅程中出现错误事件或失败请求，目标达成受到阻断。"
            : "旅程中出现交互但未观察到完成动作，初步判断为未完成。",
    aiAnomalyAnalysis: params.hasAnomaly
      ? "检测到 ui_error 或 4xx/5xx 网络请求，建议优先查看证据区。"
      : "未检测到明显错误事件或失败请求。",
  };
}

async function ensureRealJourneyTag(tenantId: string, applicationId: string) {
  return prisma.tag.upsert({
    where: {
      tenantId_type_name: {
        tenantId,
        type: TagType.JOURNEY,
        name: "真实事件聚合",
      },
    },
    create: {
      tenantId,
      applicationId,
      name: "真实事件聚合",
      type: TagType.JOURNEY,
      source: TagSource.SYSTEM,
      color: "#dbeafe",
      description: "由 BrowserEvent 自动聚合生成的真实用户旅程。",
    },
    update: {},
  });
}

async function upsertRealUser(events: BrowserEventForAggregation[]) {
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const externalId = getExternalUserId(events);
  const context = firstEvent.context;

  return prisma.user.upsert({
    where: {
      tenantId_externalId: {
        tenantId: firstEvent.tenantId,
        externalId,
      },
    },
    create: {
      tenantId: firstEvent.tenantId,
      applicationId: firstEvent.applicationId,
      externalId,
      name: firstEvent.userId ? `真实用户 ${externalId}` : `匿名访客 ${stableCodePart(externalId)}`,
      email: null,
      avatarSeed: externalId,
      deviceType: inferDevice(context),
      os: inferOs(context),
      browser: inferBrowser(context),
      location: null,
      firstSeenAt: firstEvent.timestamp,
      lastActiveAt: lastEvent.timestamp,
    },
    update: {
      lastActiveAt: lastEvent.timestamp,
    },
  });
}

async function createJourneyFromCandidate(candidate: JourneyCandidate, timeoutMs: number) {
  const events = candidate.events;
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const user = await upsertRealUser(events);
  const resultStatus = inferJourneyStatus(events);
  const hasAnomaly = events.some(isFailureEvent);
  const pageCount = events.filter((event) => event.eventType === "page_view").length;
  const keyActionCount = events.filter((event) => event.eventType === "ui_click" || event.eventType === "form_submit").length;
  const requestCount = events.filter((event) => event.eventType === "network_request").length;
  const startedAt = firstEvent.timestamp;
  const endedAt = lastEvent.timestamp;
  const totalDurationMs = Math.max(endedAt.getTime() - startedAt.getTime(), 1000);
  const effectiveDurationMs = calculateEffectiveDuration(events, timeoutMs);
  const primaryPageEvent = events.find((event) => event.pageUrl || event.pageTitle) ?? firstEvent;
  const pageUrl = primaryPageEvent.pageUrl ?? firstEvent.application.host;
  const pageTemplate = primaryPageEvent.pageTemplate ?? primaryPageEvent.pagePath ?? "/";
  const pageTitle = primaryPageEvent.pageTitle ?? primaryPageEvent.pagePath ?? firstEvent.application.name;
  const externalUserId = getExternalUserId(events);
  const summary = buildJourneySummary({
    applicationName: firstEvent.application.name,
    externalUserId,
    pageTitle,
    resultStatus,
    hasAnomaly,
    pageCount,
    keyActionCount,
    requestCount,
  });
  const journeyCode = `RJ-${startedAt.toISOString().slice(2, 10).replace(/-/g, "")}-${stableCodePart(candidate.sessionId)}-${stableCodePart(firstEvent.eventId)}`;

  const journey = await prisma.journey.create({
    data: {
      tenantId: candidate.tenantId,
      applicationId: candidate.applicationId,
      userId: user.id,
      journeyCode,
      title: `${firstEvent.application.name} 真实旅程`,
      startedAt,
      endedAt,
      totalDurationMs,
      effectiveDurationMs,
      pageCount,
      keyActionCount,
      requestCount,
      resultStatus,
      hasAnomaly,
      pageUrl,
      pageTemplate,
      pageTitle,
      businessActionType: getPrimaryBusinessAction(events, resultStatus),
      ...summary,
      source: JourneySource.REAL,
      sessionId: candidate.sessionId,
      anonymousId: events.find((event) => event.anonymousId)?.anonymousId ?? null,
      externalUserId,
      aggregationVersion,
      events: {
        create: events.map((event, index) => {
          const offsetMs = Math.max(event.timestamp.getTime() - startedAt.getTime(), 0);
          const isAnomaly = isFailureEvent(event);
          const semantic = getEventSemantic(event);

          return {
            sourceBrowserEventId: event.id,
            seq: index + 1,
            occurredAt: event.timestamp,
            offsetMs,
            type: toJourneyEventType(event),
            title: getEventTitle(event),
            description: getEventDescription(event),
            pageUrl: event.pageUrl,
            pageTemplate: event.pageTemplate ?? event.pagePath,
            pageTitle: event.pageTitle,
            region: semantic.region,
            regionSource: semantic.regionSource,
            regionConfidence: semantic.regionConfidence,
            uiAction: semantic.uiAction,
            actionType: semantic.actionType,
            businessAction: semantic.businessAction,
            businessIntent: semantic.businessIntent,
            targetLabel: semantic.targetLabel,
            targetSelector: event.targetSelector,
            targetRole: event.targetRole,
            targetText: event.targetText,
            targetTagName: event.targetTagName,
            targetTestId: event.targetTestId,
            targetData: jsonField(event.targetData),
            targetRect: jsonField(event.targetRect),
            viewport: jsonField(event.viewport),
            scroll: jsonField(event.scroll),
            interaction: jsonField(event.interaction),
            semanticPayload: jsonField(event.semanticPayload),
            aiRegionStatus: event.aiRegionStatus ?? (semantic.region ? "RESOLVED" : "PENDING"),
            aiRegionSuggestion: jsonField(event.aiRegionCandidate),
            aiRegionReason: event.aiRegionReason,
            requestId: event.requestId,
            requestUrl: event.requestUrl,
            requestHost: event.requestHost,
            method: event.requestMethod,
            pathTemplate: event.requestUrl,
            statusCode: event.requestStatus,
            durationMs: event.requestDuration,
            requestOutcome: event.requestStatus && event.requestStatus >= 400 ? "FAILED" : event.eventType === "network_request" ? "SUCCESS" : null,
            uiFeedback: event.eventType === "ui_error" ? "error" : null,
            isKeyEvent: event.eventType !== "network_request" || isAnomaly,
            isAnomaly,
          };
        }),
      },
    },
    include: {
      events: {
        orderBy: { seq: "asc" },
      },
    },
  });

  const realJourneyTag = await ensureRealJourneyTag(candidate.tenantId, candidate.applicationId);
  await prisma.journeyTag.create({
    data: {
      journeyId: journey.id,
      tagId: realJourneyTag.id,
    },
  });

  const anomalyEvents = events.filter(isFailureEvent);
  if (anomalyEvents.length) {
    await prisma.evidence.createMany({
      data: anomalyEvents.map((event) => {
        const journeyEvent = journey.events.find((item) => item.occurredAt.getTime() === event.timestamp.getTime());
        return {
          journeyId: journey.id,
          journeyEventId: journeyEvent?.id,
          type: event.eventType === "network_request" ? EvidenceType.NETWORK : EvidenceType.ERROR_NOTE,
          title: event.eventType === "network_request" ? "失败网络请求" : "浏览器错误",
          description:
            event.eventType === "network_request"
              ? `${event.requestMethod ?? "GET"} ${event.requestUrl ?? event.requestHost ?? "-"} 返回 ${event.requestStatus ?? "-"}。`
              : "浏览器捕获到错误事件或未处理 Promise 异常。",
          severity: event.eventType === "network_request" && (event.requestStatus ?? 0) < 500 ? EvidenceSeverity.WARNING : EvidenceSeverity.CRITICAL,
          content: JSON.stringify(event.context ?? event.rawPayload),
          capturedAt: event.timestamp,
          offsetMs: Math.max(event.timestamp.getTime() - startedAt.getTime(), 0),
        };
      }),
    });
  }

  await prisma.browserEvent.updateMany({
    where: {
      id: {
        in: events.map((event) => event.id),
      },
    },
    data: {
      journeyId: journey.id,
      aggregatedAt: new Date(),
    },
  });

  return {
    journey,
    linkedEvents: events.length,
  };
}

export async function aggregateBrowserEventsForTenant(
  tenantId: string,
  options: { inactivityTimeoutMs?: number; limit?: number } = {},
): Promise<AggregationResult> {
  const timeoutMs = options.inactivityTimeoutMs ?? defaultInactivityTimeoutMs;
  const limit = Math.min(options.limit ?? maxEventsPerRun, maxEventsPerRun);
  const rawEvents = await prisma.browserEvent.findMany({
    where: {
      tenantId,
      journeyId: null,
    },
    include: {
      application: true,
      tenant: true,
    },
    orderBy: [{ applicationId: "asc" }, { sessionId: "asc" }, { timestamp: "asc" }],
    take: limit,
  });

  if (!rawEvents.length) {
    return {
      createdJourneys: 0,
      linkedEvents: 0,
    };
  }

  const eventsBySession = new Map<string, BrowserEventForAggregation[]>();
  for (const event of rawEvents) {
    const key = `${event.applicationId}:${event.sessionId}`;
    const events = eventsBySession.get(key) ?? [];
    events.push(event);
    eventsBySession.set(key, events);
  }

  const candidates: JourneyCandidate[] = [];
  for (const events of Array.from(eventsBySession.values())) {
    for (const group of splitByInactivity(events, timeoutMs)) {
      candidates.push({
        tenantId: group[0].tenantId,
        applicationId: group[0].applicationId,
        sessionId: group[0].sessionId,
        events: group,
      });
    }
  }

  let createdJourneys = 0;
  let linkedEvents = 0;
  for (const candidate of candidates) {
    const result = await createJourneyFromCandidate(candidate, timeoutMs);
    createdJourneys += 1;
    linkedEvents += result.linkedEvents;
  }

  return {
    createdJourneys,
    linkedEvents,
  };
}
