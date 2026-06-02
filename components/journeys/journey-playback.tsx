"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock3, FolderKanban, Network, Tags } from "lucide-react";

import { AddToProjectDialog } from "@/components/journeys/add-to-project-dialog";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  pageTemplate: string | null;
  pageTitle: string | null;
  region: string | null;
  uiAction: string | null;
  businessAction: string | null;
  businessIntent: string | null;
  targetLabel: string | null;
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
  type: string;
  title: string;
  description: string;
  severity: string;
  content: string | null;
  offsetMs: number;
  capturedAt: string;
};

type JourneyPlaybackProps = {
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
    resultStatus: string;
    hasAnomaly: boolean;
    aiSummaryShort: string;
    aiScenarioSummary: string;
    aiProcessSummary: string;
    aiGoalAnalysis: string;
    aiAnomalyAnalysis: string;
    user: {
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
};

export function JourneyPlayback({
  journey,
  events,
  evidences,
  projects,
}: JourneyPlaybackProps) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;

  const selectedEvidence = useMemo(
    () =>
      evidences.filter(
        (evidence) =>
          Math.abs(evidence.offsetMs - (selectedEvent?.offsetMs ?? 0)) <= 25000 ||
          evidence.severity === "CRITICAL"
      ),
    [evidences, selectedEvent]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-white shadow-[var(--card-shadow)]">
          <div className="flex items-center gap-3 border-b border-[var(--border-light)] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="rounded-full border border-[var(--border-light)] bg-slate-50 px-3 py-1 text-xs text-slate-500">
              {journey.pageUrl}
            </div>
          </div>

          <div className="space-y-4 bg-[linear-gradient(180deg,#f8fbff_0%,#f3f7fb_100%)] p-5">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                    当前时间锚点
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">
                    {selectedEvent?.title ?? "暂无事件"}
                  </div>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    {selectedEvent?.description}
                  </p>
                </div>
                <StatusPill
                  label={selectedEvent?.isAnomaly ? "异常锚点" : "关键节点"}
                  tone={selectedEvent?.isAnomaly ? "error" : "info"}
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">页面结构模拟</div>
                    <div className="text-xs text-slate-500">{journey.pageTitle}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-10 rounded-xl bg-slate-100" />
                    <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
                      <div className="space-y-3">
                        <div className="h-28 rounded-xl bg-slate-100" />
                        <div className="h-16 rounded-xl bg-slate-100" />
                      </div>
                      <div className="h-[172px] rounded-xl bg-slate-100" />
                    </div>
                  </div>
                </div>

                {selectedEvent?.isAnomaly ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                      <AlertTriangle className="h-4 w-4" />
                      支付组件初始化失败
                    </div>
                    <p className="mt-2 text-sm text-rose-700">
                      TypeError: Cannot read properties of undefined (reading &apos;mount&apos;)
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    当前锚点没有系统异常，播放器区域用 mock 结构表达页面上下文与焦点状态。
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-4 text-sm font-semibold text-slate-900">当前节点上下文</div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">业务动作</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedEvent?.businessAction ?? "无"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">区域定位</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedEvent?.region ?? "未识别"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">页面模板</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedEvent?.pageTemplate ?? journey.pageTemplate}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-400">时间位置</div>
                    <div className="mt-1 font-medium text-slate-900">
                      {selectedEvent ? formatDuration(selectedEvent.offsetMs) : "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">旅程时间线</div>
                <div className="text-xs text-slate-500">
                  总时长 {formatDuration(journey.totalDurationMs)} / 有效时长{" "}
                  {formatDuration(journey.effectiveDurationMs)}
                </div>
              </div>
              <div className="relative h-10">
                <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
                {events.map((event) => {
                  const percent = (event.offsetMs / journey.totalDurationMs) * 100;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={cn(
                        "absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow",
                        event.isAnomaly ? "bg-rose-500" : "bg-[var(--primary)]",
                        selectedEventId === event.id && "ring-4 ring-blue-100"
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
      </div>

      <div className="space-y-4">
        <SectionCard title="AI 旅程洞察" className="border-[var(--border-light)] shadow-[var(--card-shadow)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-violet-200 bg-[var(--ai-purple-light)] p-4">
              <div className="mb-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ai-purple)]">
                AI
              </div>
              <p className="text-sm leading-7 text-slate-800">{journey.aiSummaryShort}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">目标达成分析</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{journey.aiGoalAnalysis}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">异常判断</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{journey.aiAnomalyAnalysis}</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <Tabs defaultValue="summary" className="rounded-2xl border border-[var(--border-light)] bg-white shadow-[var(--card-shadow)]">
          <TabsList className="m-4 mb-0">
            <TabsTrigger value="summary">旅程摘要</TabsTrigger>
            <TabsTrigger value="timeline">时间线</TabsTrigger>
            <TabsTrigger value="context">上下文</TabsTrigger>
            <TabsTrigger value="evidence">证据与异常</TabsTrigger>
            <TabsTrigger value="research">标签与研究</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4 p-4">
            <SectionCard title="使用场景还原">
              <p className="text-sm leading-7 text-slate-600">{journey.aiScenarioSummary}</p>
            </SectionCard>
            <SectionCard title="行为过程摘要">
              <p className="text-sm leading-7 text-slate-600">{journey.aiProcessSummary}</p>
            </SectionCard>
            <SectionCard title="旅程概况">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="text-xs text-slate-400">开始时间</div>
                  <div className="mt-1 font-medium text-slate-900">{formatDateTimeFull(journey.startedAt)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="text-xs text-slate-400">结束时间</div>
                  <div className="mt-1 font-medium text-slate-900">{formatDateTimeFull(journey.endedAt)}</div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-3 p-4">
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEventId(event.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  selectedEventId === event.id
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <div
                  className={cn(
                    "mt-1 h-3 w-3 rounded-full",
                    event.isAnomaly ? "bg-rose-500" : "bg-[var(--primary)]"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900">{event.title}</div>
                    <div className="text-xs text-slate-400">{formatDuration(event.offsetMs)}</div>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p>
                </div>
              </button>
            ))}
          </TabsContent>

          <TabsContent value="context" className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">页面上下文</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>page_template: {selectedEvent?.pageTemplate ?? journey.pageTemplate}</div>
                  <div>page_title: {selectedEvent?.pageTitle ?? journey.pageTitle}</div>
                  <div>page_url: {journey.pageUrl}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">动作上下文</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>ui_action: {selectedEvent?.uiAction ?? "无"}</div>
                  <div>business_action: {selectedEvent?.businessAction ?? "无"}</div>
                  <div>business_intent: {selectedEvent?.businessIntent ?? "无"}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">请求上下文</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>request_host: {selectedEvent?.requestHost ?? "无"}</div>
                  <div>path_template: {selectedEvent?.pathTemplate ?? "无"}</div>
                  <div>status_code: {selectedEvent?.statusCode ?? "无"}</div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">结果上下文</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <div>request_outcome: {selectedEvent?.requestOutcome ?? "无"}</div>
                  <div>ui_feedback: {selectedEvent?.uiFeedback ?? "无"}</div>
                  <div>target_label: {selectedEvent?.targetLabel ?? "无"}</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="space-y-3 p-4">
            {selectedEvidence.map((evidence) => (
              <div key={evidence.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {evidence.type === "NETWORK" ? <Network className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {evidence.title}
                  </div>
                  <StatusPill
                    label={evidence.severity}
                    tone={evidence.severity === "CRITICAL" ? "error" : evidence.severity === "WARNING" ? "warning" : "neutral"}
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
          </TabsContent>

          <TabsContent value="research" className="space-y-4 p-4">
            <SectionCard
              title="标签"
              action={<Tags className="h-4 w-4 text-slate-400" />}
            >
              <div className="flex flex-wrap gap-2">
                {journey.journeyTags.map(({ tag }) => (
                  <TagChip key={tag.id} label={tag.name} color={tag.color} />
                ))}
                {journey.user.userTags.map(({ tag }) => (
                  <TagChip key={tag.id} label={tag.name} color={tag.color} />
                ))}
              </div>
            </SectionCard>
            <SectionCard
              title="所属研究项目"
              action={<FolderKanban className="h-4 w-4 text-slate-400" />}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {journey.projectJourneys.map(({ project }) => (
                    <TagChip key={project.id} label={project.name} />
                  ))}
                </div>
                <AddToProjectDialog
                  journeyId={journey.id}
                  projects={projects}
                  currentProjectIds={journey.projectJourneys.map(({ project }) => project.id)}
                />
              </div>
            </SectionCard>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <Clock3 className="h-4 w-4" />
                研究归档建议
              </div>
              当前旅程已具备明确的目标、转折点和证据链，适合作为结算页体验研究的核心样本。
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

