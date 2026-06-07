import { ApplicationStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const supportedEventTypes = new Set(["page_view", "ui_click", "form_submit", "network_request", "ui_error"]);
const maxBatchSize = 100;

type IngestEventInput = {
  eventId?: unknown;
  sessionId?: unknown;
  userId?: unknown;
  anonymousId?: unknown;
  eventType?: unknown;
  timestamp?: unknown;
  page?: {
    url?: unknown;
    host?: unknown;
    path?: unknown;
    template?: unknown;
    title?: unknown;
    referrer?: unknown;
  };
  semantic?: {
    region?: unknown;
    regionSource?: unknown;
    regionConfidence?: unknown;
    action?: unknown;
    actionType?: unknown;
    businessAction?: unknown;
    businessIntent?: unknown;
    pageTemplate?: unknown;
    targetLabel?: unknown;
    payload?: unknown;
    aiRegionStatus?: unknown;
    aiRegionCandidate?: unknown;
    aiRegionReason?: unknown;
  };
  target?: {
    label?: unknown;
    text?: unknown;
    selector?: unknown;
    role?: unknown;
    tagName?: unknown;
    testId?: unknown;
    data?: unknown;
    rect?: unknown;
  };
  viewport?: unknown;
  scroll?: unknown;
  interaction?: unknown;
  request?: {
    url?: unknown;
    host?: unknown;
    method?: unknown;
    statusCode?: unknown;
    durationMs?: unknown;
    requestId?: unknown;
  };
  context?: unknown;
};

type NormalizedEvent = {
  eventId: string;
  sessionId: string;
  userId: string | null;
  anonymousId: string | null;
  eventType: string;
  timestamp: Date;
  pageUrl: string | null;
  pageHost: string | null;
  pagePath: string | null;
  pageTemplate: string | null;
  pageTitle: string | null;
  referrer: string | null;
  region: string | null;
  regionSource: string | null;
  regionConfidence: number | null;
  action: string | null;
  actionType: string | null;
  businessAction: string | null;
  businessIntent: string | null;
  targetLabel: string | null;
  targetSelector: string | null;
  targetRole: string | null;
  targetText: string | null;
  targetTagName: string | null;
  targetTestId: string | null;
  targetData: Prisma.InputJsonValue | null;
  targetRect: Prisma.InputJsonValue | null;
  viewport: Prisma.InputJsonValue | null;
  scroll: Prisma.InputJsonValue | null;
  interaction: Prisma.InputJsonValue | null;
  semanticPayload: Prisma.InputJsonValue | null;
  aiRegionStatus: string | null;
  aiRegionCandidate: Prisma.InputJsonValue | null;
  aiRegionReason: string | null;
  requestUrl: string | null;
  requestHost: string | null;
  requestMethod: string | null;
  requestStatus: number | null;
  requestDuration: number | null;
  requestId: string | null;
  context: Prisma.InputJsonValue | null;
  rawPayload: Prisma.InputJsonValue;
};

function corsHeaders(request: Request) {
  return {
    "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-app-key, x-ingest-token",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(request: Request, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init?.headers ?? {}),
    },
  });
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function readFloat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseTimestamp(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function normalizeHost(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    if (value.includes("://")) {
      return new URL(value).hostname.toLowerCase();
    }
  } catch {
    return null;
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

function hostFromUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(observedHost: string | null, configuredHost: string) {
  const observed = normalizeHost(observedHost);
  const configured = normalizeHost(configuredHost);

  if (!observed || !configured) {
    return false;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    configured.endsWith(".demo.local") &&
    ["localhost", "127.0.0.1", "::1"].includes(observed)
  ) {
    return true;
  }

  return observed === configured || observed.endsWith(`.${configured}`);
}

function getRequestHost(request: Request) {
  const originHost = hostFromUrl(request.headers.get("origin"));
  const refererHost = hostFromUrl(request.headers.get("referer"));
  return originHost ?? refererHost;
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  return authorization.slice("bearer ".length).trim() || null;
}

function normalizeRawPayload(value: unknown): Prisma.InputJsonValue {
  if (value && typeof value === "object") {
    return value as Prisma.InputJsonValue;
  }
  return { value } as Prisma.InputJsonValue;
}

function normalizeContext(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Prisma.InputJsonValue;
}

function compactJsonValue(value: unknown): Prisma.JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => compactJsonValue(item))
      .filter((item): item is Prisma.JsonValue => item !== undefined);
  }
  if (typeof value === "object") {
    const result: Record<string, Prisma.JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const compacted = compactJsonValue(item);
      if (compacted !== undefined) {
        result[key] = compacted;
      }
    }
    return result;
  }
  return String(value);
}

function normalizeJsonObject(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return (compactJsonValue(value) as Prisma.InputJsonValue | undefined) ?? null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const result = readString(value);
    if (result) {
      return result;
    }
  }
  return null;
}

function pickContextTarget(context: Record<string, unknown> | null) {
  return readRecord(context?.target);
}

function normalizeActionName(value: string | null) {
  return value?.trim().replace(/\s+/g, "_").toLowerCase() ?? null;
}

function buildAiRegionCandidate(input: {
  pageUrl: string | null;
  pagePath: string | null;
  pageTemplate: string | null;
  pageTitle: string | null;
  eventType: string;
  action: string | null;
  actionType: string | null;
  businessAction: string | null;
  targetLabel: string | null;
  targetSelector: string | null;
  targetRole: string | null;
  targetText: string | null;
  targetTagName: string | null;
  targetTestId: string | null;
  targetData: Prisma.InputJsonValue | null;
  targetRect: Prisma.InputJsonValue | null;
  viewport: Prisma.InputJsonValue | null;
  scroll: Prisma.InputJsonValue | null;
  interaction: Prisma.InputJsonValue | null;
}): Prisma.InputJsonValue {
  return {
    page: {
      url: input.pageUrl,
      path: input.pagePath,
      template: input.pageTemplate,
      title: input.pageTitle,
    },
    event: {
      type: input.eventType,
      action: input.action,
      actionType: input.actionType,
      businessAction: input.businessAction,
    },
    target: {
      label: input.targetLabel,
      selector: input.targetSelector,
      role: input.targetRole,
      text: input.targetText,
      tagName: input.targetTagName,
      testId: input.targetTestId,
      data: input.targetData,
      rect: input.targetRect,
    },
    viewport: input.viewport,
    scroll: input.scroll,
    interaction: input.interaction,
  } as Prisma.InputJsonValue;
}

function normalizeEvent(input: IngestEventInput, index: number): { event?: NormalizedEvent; error?: string } {
  const eventId = readString(input.eventId);
  const sessionId = readString(input.sessionId);
  const eventType = readString(input.eventType);
  const timestamp = parseTimestamp(input.timestamp);

  if (!eventId) {
    return { error: `第 ${index + 1} 条事件缺少 eventId。` };
  }
  if (!sessionId) {
    return { error: `事件 ${eventId} 缺少 sessionId。` };
  }
  if (!eventType || !supportedEventTypes.has(eventType)) {
    return { error: `事件 ${eventId} 的 eventType 不支持。` };
  }
  if (!timestamp) {
    return { error: `事件 ${eventId} 缺少有效 timestamp。` };
  }

  const pageUrl = readString(input.page?.url);
  const pageHost = normalizeHost(readString(input.page?.host) ?? hostFromUrl(pageUrl));
  const pagePath = readString(input.page?.path);
  const pageTemplate = firstString(input.page?.template, input.semantic?.pageTemplate, pagePath);
  const requestUrl = readString(input.request?.url);
  const requestHost = normalizeHost(readString(input.request?.host) ?? hostFromUrl(requestUrl));
  const contextRecord = readRecord(input.context);
  const contextTarget = pickContextTarget(contextRecord);
  const targetData = normalizeJsonObject(input.target?.data ?? contextTarget?.data);
  const targetRect = normalizeJsonObject(input.target?.rect ?? contextTarget?.rect);
  const viewport = normalizeJsonObject(input.viewport ?? contextRecord?.viewport);
  const scroll = normalizeJsonObject(input.scroll ?? contextRecord?.scroll);
  const interaction = normalizeJsonObject(input.interaction ?? contextRecord?.pointer);
  const action = normalizeActionName(
    firstString(input.semantic?.action, contextRecord?.eventName, contextRecord?.action),
  );
  const actionType = firstString(input.semantic?.actionType, contextRecord?.actionType, input.eventType);
  const businessAction = firstString(input.semantic?.businessAction, contextRecord?.businessAction, contextRecord?.eventName);
  const targetLabel = firstString(input.semantic?.targetLabel, input.target?.label, input.target?.text, contextTarget?.ariaLabel, contextTarget?.text, contextTarget?.name, contextTarget?.id);
  const targetSelector = firstString(input.target?.selector, contextTarget?.selector);
  const targetRole = firstString(input.target?.role, contextTarget?.role);
  const targetText = firstString(input.target?.text, contextTarget?.text);
  const targetTagName = firstString(input.target?.tagName, contextTarget?.tagName);
  const targetTestId = firstString(input.target?.testId, contextTarget?.testId);
  const semanticPayload =
    normalizeJsonObject(input.semantic) ??
    normalizeJsonObject({
      eventName: contextRecord?.eventName,
      payload: contextRecord?.payload,
      target: contextTarget ?? undefined,
    });
  const region = firstString(input.semantic?.region, contextRecord?.region);
  const regionSource = region ? firstString(input.semantic?.regionSource, contextRecord?.regionSource, "sdk") : null;
  const regionConfidence = region ? (readFloat(input.semantic?.regionConfidence ?? contextRecord?.regionConfidence) ?? 0.8) : null;
  const aiRegionStatus = firstString(input.semantic?.aiRegionStatus, contextRecord?.aiRegionStatus, region ? "RESOLVED" : "PENDING");
  const explicitAiCandidate = normalizeJsonObject(input.semantic?.aiRegionCandidate ?? contextRecord?.aiRegionCandidate);
  const generatedAiCandidate = buildAiRegionCandidate({
    pageUrl,
    pagePath,
    pageTemplate,
    pageTitle: readString(input.page?.title),
    eventType,
    action,
    actionType,
    businessAction,
    targetLabel,
    targetSelector,
    targetRole,
    targetText,
    targetTagName,
    targetTestId,
    targetData,
    targetRect,
    viewport,
    scroll,
    interaction,
  });

  return {
    event: {
      eventId,
      sessionId,
      userId: readString(input.userId),
      anonymousId: readString(input.anonymousId),
      eventType,
      timestamp,
      pageUrl,
      pageHost,
      pagePath,
      pageTemplate,
      pageTitle: readString(input.page?.title),
      referrer: readString(input.page?.referrer),
      region,
      regionSource,
      regionConfidence,
      action,
      actionType,
      businessAction,
      businessIntent: firstString(input.semantic?.businessIntent, contextRecord?.businessIntent),
      targetLabel,
      targetSelector,
      targetRole,
      targetText,
      targetTagName,
      targetTestId,
      targetData,
      targetRect,
      viewport,
      scroll,
      interaction,
      semanticPayload,
      aiRegionStatus,
      aiRegionCandidate: explicitAiCandidate ?? generatedAiCandidate,
      aiRegionReason: firstString(input.semantic?.aiRegionReason, contextRecord?.aiRegionReason),
      requestUrl,
      requestHost,
      requestMethod: readString(input.request?.method)?.toUpperCase() ?? null,
      requestStatus: readNumber(input.request?.statusCode),
      requestDuration: readNumber(input.request?.durationMs),
      requestId: readString(input.request?.requestId),
      context: normalizeContext(input.context),
      rawPayload: normalizeRawPayload(input),
    },
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { ok: false, error: "请求体必须是合法 JSON。" }, { status: 400 });
  }

  const token = readBearerToken(request) ?? readString(request.headers.get("x-ingest-token")) ?? readString(body.token);
  const appKey = readString(request.headers.get("x-app-key")) ?? readString(body.appKey);

  if (!token) {
    return jsonResponse(request, { ok: false, error: "缺少接入 token。" }, { status: 401 });
  }

  const application = await prisma.application.findFirst({
    where: {
      ingestToken: token,
      ...(appKey ? { appKey } : {}),
    },
    include: {
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!application) {
    return jsonResponse(request, { ok: false, error: "appKey 或 token 无效。" }, { status: 401 });
  }

  if (application.status === ApplicationStatus.INACTIVE) {
    await prisma.integrationLog.create({
      data: {
        tenantId: application.tenantId,
        applicationId: application.id,
        level: "warn",
        status: "REJECTED",
        source: "ingest.browser-events",
        message: "应用处于未启用状态，拒绝接收浏览器事件。",
        payloadSummary: `appKey=${application.appKey}`,
      },
    });
    return jsonResponse(request, { ok: false, error: "应用处于未启用状态。" }, { status: 403 });
  }

  const eventsInput = Array.isArray(body.events) ? body.events : body.event ? [body.event] : [];
  if (!eventsInput.length) {
    return jsonResponse(request, { ok: false, error: "缺少 events 数组。" }, { status: 400 });
  }
  if (eventsInput.length > maxBatchSize) {
    return jsonResponse(request, { ok: false, error: `单次最多上报 ${maxBatchSize} 条事件。` }, { status: 413 });
  }

  const requestHost = getRequestHost(request);
  const rejected: Array<{ index: number; eventId?: string; reason: string }> = [];
  const normalizedEvents: NormalizedEvent[] = [];

  eventsInput.forEach((rawEvent, index) => {
    if (!rawEvent || typeof rawEvent !== "object") {
      rejected.push({ index, reason: `第 ${index + 1} 条事件必须是对象。` });
      return;
    }

    const { event, error } = normalizeEvent(rawEvent as IngestEventInput, index);
    if (!event) {
      rejected.push({ index, eventId: readString((rawEvent as IngestEventInput).eventId) ?? undefined, reason: error ?? "事件格式无效。" });
      return;
    }

    const observedHost = event.pageHost ?? requestHost;
    if (!hostMatches(observedHost, application.host)) {
      rejected.push({
        index,
        eventId: event.eventId,
        reason: `host 不匹配：${observedHost ?? "unknown"} 不属于 ${application.host}。`,
      });
      return;
    }

    normalizedEvents.push(event);
  });

  let duplicateCount = 0;
  let insertedCount = 0;

  if (normalizedEvents.length) {
    const existingEvents = await prisma.browserEvent.findMany({
      where: {
        applicationId: application.id,
        eventId: {
          in: normalizedEvents.map((event) => event.eventId),
        },
      },
      select: { eventId: true },
    });
    const existingIds = new Set(existingEvents.map((event) => event.eventId));
    const eventsToInsert = normalizedEvents.filter((event) => !existingIds.has(event.eventId));
    duplicateCount = normalizedEvents.length - eventsToInsert.length;

    if (eventsToInsert.length) {
      const result = await prisma.browserEvent.createMany({
        data: eventsToInsert.map((event) => {
          const {
            context,
            targetData,
            targetRect,
            viewport,
            scroll,
            interaction,
            semanticPayload,
            aiRegionCandidate,
            ...restEvent
          } = event;
          const data: Prisma.BrowserEventCreateManyInput = {
            tenantId: application.tenantId,
            applicationId: application.id,
            appKey: application.appKey,
            ...restEvent,
            context: context ?? Prisma.JsonNull,
          };

          if (targetData) data.targetData = targetData;
          if (targetRect) data.targetRect = targetRect;
          if (viewport) data.viewport = viewport;
          if (scroll) data.scroll = scroll;
          if (interaction) data.interaction = interaction;
          if (semanticPayload) data.semanticPayload = semanticPayload;
          if (aiRegionCandidate) data.aiRegionCandidate = aiRegionCandidate;

          return data;
        }),
      });
      insertedCount = result.count;
    }
  }

  const acceptedOrDuplicateCount = insertedCount + duplicateCount;
  const level = rejected.length ? (acceptedOrDuplicateCount ? "warn" : "error") : "info";
  const status = acceptedOrDuplicateCount ? (rejected.length ? "PARTIAL_ACCEPTED" : "ACCEPTED") : "REJECTED";
  const latestTimestamp = normalizedEvents.reduce<Date | null>((latest, event) => {
    if (!latest || event.timestamp > latest) {
      return event.timestamp;
    }
    return latest;
  }, null);

  await prisma.$transaction([
    prisma.integrationLog.create({
      data: {
        tenantId: application.tenantId,
        applicationId: application.id,
        level,
        status,
        source: "ingest.browser-events",
        message: `浏览器事件上报：入库 ${insertedCount} 条，重复 ${duplicateCount} 条，拒收 ${rejected.length} 条。`,
        payloadSummary: `tenant=${application.tenant.slug}; appKey=${application.appKey}; batch=${eventsInput.length}; types=${
          Array.from(new Set(normalizedEvents.map((event) => event.eventType))).join(",") || "-"
        }`,
      },
    }),
    prisma.application.update({
      where: { id: application.id },
      data: {
        lastReportedAt: latestTimestamp ?? new Date(),
        ...(application.status === ApplicationStatus.PENDING ? { status: ApplicationStatus.ACTIVE } : {}),
      },
    }),
  ]);

  return jsonResponse(request, {
    ok: acceptedOrDuplicateCount > 0,
    tenantId: application.tenantId,
    tenantSlug: application.tenant.slug,
    applicationId: application.id,
    appKey: application.appKey,
    received: eventsInput.length,
    accepted: insertedCount,
    duplicate: duplicateCount,
    rejected,
    supportedEventTypes: Array.from(supportedEventTypes),
  });
}
