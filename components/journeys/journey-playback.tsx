"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Network,
  TimerReset,
} from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDateTimeFull, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

type SerializedEvent = {
  id: string;
  seq: number;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  offsetMs: number;
  pageUrl: string | null;
  pageTemplate: string | null;
  pageTitle: string | null;
  region: string | null;
  regionSource: string | null;
  regionConfidence: number | null;
  uiAction: string | null;
  actionType: string | null;
  businessAction: string | null;
  businessIntent: string | null;
  targetLabel: string | null;
  targetSelector: string | null;
  targetRole: string | null;
  targetText: string | null;
  targetTagName: string | null;
  targetTestId: string | null;
  aiRegionStatus: string | null;
  requestId: string | null;
  requestUrl: string | null;
  requestHost: string | null;
  method: string | null;
  pathTemplate: string | null;
  statusCode: number | null;
  durationMs: number | null;
  requestOutcome: string | null;
  uiFeedback: string | null;
  isAnomaly: boolean;
};

type SerializedEvidence = {
  id: string;
  journeyEventId: string | null;
  type: string;
  title: string;
  description: string;
  severity: string;
  imageUrl: string | null;
  content: string | null;
  offsetMs: number;
  capturedAt: string;
};

type JourneyPlaybackProps = {
  tenantSlug?: string;
  journey: {
    id: string;
    journeyCode: string;
    title: string;
    startedAt: string;
    endedAt: string;
    totalDurationMs: number;
    effectiveDurationMs: number;
    pageUrl: string;
    pageTemplate: string;
    pageTitle: string;
    resultStatusLabel: string;
    hasAnomaly: boolean;
    businessActionType: string;
    pageCount: number;
    keyActionCount: number;
    requestCount: number;
    aiSummaryShort: string;
    aiScenarioSummary: string;
    aiProcessSummary: string;
    aiGoalAnalysis: string;
    aiAnomalyAnalysis: string;
    user: {
      id: string;
      externalId: string;
      name: string;
      deviceType: string;
      os: string;
      browser: string;
      userTags: Array<{ tag: { id: string; name: string; color: string } }>;
    };
    journeyTags: Array<{ tag: { id: string; name: string; color: string } }>;
    projectJourneys: Array<{ project: { id: string; name: string } }>;
  };
  events: SerializedEvent[];
  evidences: SerializedEvidence[];
  projects: Array<{ id: string; name: string; goal: string }>;
  availableJourneyTags: Array<{
    id: string;
    name: string;
    color: string;
    description: string | null;
  }>;
};

const eventTypeLabelMap: Record<string, string> = {
  PAGE_VIEW: "页面进入",
  REGION_ACTION: "区域动作",
  BUSINESS_ACTION: "关键动作",
  REQUEST: "请求结果",
  STATE_CHANGE: "状态切换",
  FEEDBACK: "界面反馈",
  ANOMALY: "异常事件",
  EXIT: "退出",
};

function toneForSeverity(severity: string) {
  if (severity === "CRITICAL") {
    return "error";
  }
  if (severity === "WARNING") {
    return "warning";
  }
  return "neutral";
}

export function JourneyPlayback({
  journey,
  events,
  evidences,
}: JourneyPlaybackProps) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;

  const relatedEvidence = useMemo(
    () =>
      evidences.filter(
        (evidence) =>
          evidence.journeyEventId === selectedEvent?.id ||
          Math.abs(evidence.offsetMs - (selectedEvent?.offsetMs ?? 0)) <= 30000,
      ),
    [evidences, selectedEvent],
  );

  const failedRequests = useMemo(
    () => events.filter((event) => event.type === "REQUEST" && (event.statusCode ?? 0) >= 400),
    [events],
  );
  const slowRequests = useMemo(
    () => events.filter((event) => event.type === "REQUEST" && (event.durationMs ?? 0) >= 1800),
    [events],
  );
  const feedbackEvidence = useMemo(
    () =>
      evidences.filter((evidence) =>
        ["TOAST", "SCREENSHOT", "DOM_SNAPSHOT"].includes(evidence.type),
      ),
    [evidences],
  );

  const contextRows = [
    { label: "page", name: "页面地址", value: selectedEvent?.pageUrl ?? journey.pageUrl },
    { label: "template", name: "页面模板", value: selectedEvent?.pageTemplate ?? journey.pageTemplate },
    {
      label: "region",
      name: "区域识别",
      value: selectedEvent?.region
        ? `${selectedEvent.region}${selectedEvent.regionSource ? ` · ${selectedEvent.regionSource}` : ""}`
        : selectedEvent?.aiRegionStatus === "PENDING"
          ? "待 AI 解构"
          : "未识别",
    },
    { label: "action", name: "动作语义", value: selectedEvent?.uiAction ?? selectedEvent?.businessAction ?? "无" },
    { label: "target", name: "交互对象", value: selectedEvent?.targetLabel ?? selectedEvent?.targetText ?? "无" },
    { label: "selector", name: "选择器", value: selectedEvent?.targetSelector ?? "无" },
    { label: "request", name: "请求信息", value: selectedEvent?.requestUrl ?? selectedEvent?.pathTemplate ?? "无" },
    {
      label: "result",
      name: "结果反馈",
      value:
        selectedEvent?.requestOutcome ??
        selectedEvent?.uiFeedback ??
        (selectedEvent?.statusCode ? `HTTP ${selectedEvent.statusCode}` : "无"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-white shadow-[var(--card-shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-light)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">时间轴分析</h2>
            <p className="mt-1 text-xs text-slate-500">点击任意时间戳，右侧同步展示该节点的关键信息、上下文和证据。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={`${events.length} 个时间点`} tone="info" />
            <StatusPill label={`总时长 ${formatDuration(journey.totalDurationMs)}`} tone="neutral" />
          </div>
        </div>

        <div className="grid gap-6 bg-[linear-gradient(180deg,#f8fbff_0%,#f3f7fb_100%)] p-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <div className="min-w-0 truncate rounded-full border border-[var(--border-light)] bg-slate-50 px-3 py-1 text-xs text-slate-500">
                  {selectedEvent?.pageUrl ?? journey.pageUrl}
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">当前关键帧</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{selectedEvent?.title ?? "暂无事件"}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{selectedEvent?.description ?? "当前旅程还没有可展示的时间线节点。"}</p>
                    </div>
                    <StatusPill label={selectedEvent?.isAnomaly ? "异常锚点" : "关键节点"} tone={selectedEvent?.isAnomaly ? "error" : "info"} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">关键帧预览</div>
                    <div className="text-xs text-slate-500">{journey.pageTitle}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-10 rounded-xl bg-slate-100" />
                    <div className="grid grid-cols-[1.15fr_0.85fr] gap-3">
                      <div className="space-y-3">
                        <div className="h-28 rounded-xl bg-slate-100" />
                        <div className="h-16 rounded-xl bg-slate-100" />
                      </div>
                      <div className="h-[172px] rounded-xl bg-slate-100" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">时间轨道</div>
                    <div className="text-xs text-slate-500">点击圆点定位节点</div>
                  </div>
                  <div className="relative h-10">
                    <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                    {events.map((event) => {
                      const percent = Math.max(2, Math.min(98, (event.offsetMs / journey.totalDurationMs) * 100));
                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={cn(
                            "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition",
                            event.isAnomaly ? "bg-rose-500" : "bg-[var(--primary)]",
                            selectedEventId === event.id && "ring-4 ring-blue-100",
                          )}
                          style={{ left: `${percent}%` }}
                          onClick={() => setSelectedEventId(event.id)}
                          title={event.title}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <SectionCard title="关键时间线" description="每个时间戳只展示判断节点所需的关键信息点。">
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                      selectedEventId === event.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <div className={cn("mt-1 h-3 w-3 rounded-full", event.isAnomaly ? "bg-rose-500" : "bg-[var(--primary)]")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                            <StatusPill label={eventTypeLabelMap[event.type] ?? event.type} tone={event.isAnomaly ? "error" : "neutral"} />
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-slate-400">
                          <div>{formatDuration(event.offsetMs)}</div>
                          <div className="mt-1">{formatDateTimeFull(event.occurredAt)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">区域：{event.region ?? (event.aiRegionStatus === "PENDING" ? "待 AI 解构" : "未识别")}</div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">动作：{event.businessAction ?? event.uiAction ?? "无"}</div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2">结果：{event.requestOutcome ?? event.uiFeedback ?? (event.statusCode ? `HTTP ${event.statusCode}` : "无")}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <SectionCard title="当前时间戳关键信息" description="跟随左侧时间线选择实时切换。">
              <div className="space-y-4">
                <div className={cn("rounded-2xl border p-4", selectedEvent?.isAnomaly ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{selectedEvent?.title ?? "暂无事件"}</div>
                    <StatusPill label={selectedEvent?.isAnomaly ? "异常节点" : "普通节点"} tone={selectedEvent?.isAnomaly ? "error" : "neutral"} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedEvent?.description ?? "当前没有可解释的事件描述。"}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{formatDuration(selectedEvent?.offsetMs ?? 0)}</span>
                    {selectedEvent ? <span>{formatDateTimeFull(selectedEvent.occurredAt)}</span> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <AlertTriangle className="h-4 w-4" />
                    当前节点判断
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedEvent?.isAnomaly
                      ? "该节点存在异常信号，建议结合证据区与失败请求判断是否为直接阻断点。"
                      : "该节点没有直接技术异常，更适合观察用户理解成本、路径连续性与反馈是否充分。"}
                  </p>
                </div>
              </div>
            </SectionCard>

          <SectionCard title="上下文信息区" description="围绕当前选中节点查看 page / region / action / request / result。">
            <div className="grid gap-3">
              {contextRows.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.name}</div>
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="异常证据区" description="集中展示失败请求、长耗时请求与 UI 反馈类证据。">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Network className="h-4 w-4" />
                  失败请求
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  {failedRequests.length === 0 ? (
                    <div>暂无失败请求。</div>
                  ) : (
                    failedRequests.map((event) => (
                      <div key={event.id}>
                        {event.pathTemplate} · status {event.statusCode}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TimerReset className="h-4 w-4" />
                  长耗时请求
                </div>
                <div className="space-y-2 text-sm text-slate-600">
                  {slowRequests.length === 0 ? (
                    <div>暂无长耗时请求。</div>
                  ) : (
                    slowRequests.map((event) => (
                      <div key={event.id}>
                        {event.pathTemplate} · {event.durationMs} ms
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <AlertTriangle className="h-4 w-4" />
                  toast / dialog / screenshot
                </div>
                <div className="space-y-3">
                  {(relatedEvidence.length ? relatedEvidence : feedbackEvidence.slice(0, 3)).map((evidence) => (
                    <div key={evidence.id} className="rounded-xl bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{evidence.title}</div>
                        <StatusPill
                          label={evidence.severity}
                          tone={toneForSeverity(evidence.severity)}
                        />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{evidence.description}</p>
                      {evidence.content ? (
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs leading-6 text-slate-100">
                          {evidence.content}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                  {relatedEvidence.length === 0 && feedbackEvidence.length === 0 ? (
                    <div className="rounded-xl bg-white p-3 text-sm text-slate-500">暂无 toast、dialog、截图或 DOM 证据。</div>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>

        </div>
      </div>
      </div>
    </div>
  );
}
