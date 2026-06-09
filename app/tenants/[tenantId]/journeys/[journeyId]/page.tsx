import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Agent2ModelLogs } from "@/components/journeys/agent2-model-logs";
import { AddToProjectDialog } from "@/components/journeys/add-to-project-dialog";
import { JourneyAgent2AnalysisCard } from "@/components/journeys/journey-agent2-analysis-card";
import { JourneyDetailAnalysis } from "@/components/journeys/journey-detail-analysis";
import { RunAgent2Button } from "@/components/journeys/run-agent2-button";
import { PageHeader } from "@/components/layout/page-header";
import { AssignTagDialog } from "@/components/shared/assign-tag-dialog";
import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { getTenantJourneyDetailShell, journeyStatusLabelMap } from "@/lib/tenant-data";
import { formatDateTimeFull, formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantJourneyDetailPage({
  params,
}: {
  params: { tenantId: string; journeyId: string };
}) {
  const detail = await getTenantJourneyDetailShell(params.tenantId, params.journeyId);

  if (!detail) {
    notFound();
  }

  const { tenant, journey, aiAnalysis, projects, availableJourneyTags, agent2ModelLogs } = detail;
  const mergedTags = Array.from(
    [...journey.journeyTags.map(({ tag }) => tag), ...journey.user.userTags.map(({ tag }) => tag)]
      .reduce((map, tag) => {
        if (!map.has(tag.name)) {
          map.set(tag.name, tag);
        }
        return map;
      }, new Map<string, (typeof journey.journeyTags)[number]["tag"]>())
      .values(),
  );
  const currentProjectIds = journey.projectJourneys.map(({ project }) => project.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${journey.journeyCode} · ${journey.user.externalId}`}
        subtitle={journey.title}
        actions={
          <>
            <Link href={`/tenants/${tenant.slug}/journeys`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              返回列表
            </Link>
            <div className="flex items-center gap-2">
              <StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={journey.resultStatus === "FAILED" ? "error" : journey.resultStatus === "COMPLETED" ? "success" : "warning"} />
              <StatusPill label={journey.hasAnomaly ? "高危异常" : "无明显异常"} tone={journey.hasAnomaly ? "error" : "neutral"} />
              <StatusPill label={journey.source === "REAL" ? "真实聚合" : "Demo fallback"} tone={journey.source === "REAL" ? "info" : "neutral"} />
            </div>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="旅程基础信息" description="只保留判断这条旅程所需的核心事实。">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">旅程 ID</div><div className="mt-2 font-mono text-sm font-semibold text-slate-900">{journey.journeyCode}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">用户 ID</div><div className="mt-2 font-mono text-sm font-semibold text-slate-900">{journey.user.externalId}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">状态</div><div className="mt-2 flex flex-wrap gap-2"><StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={journey.resultStatus === "FAILED" ? "error" : journey.resultStatus === "COMPLETED" ? "success" : "warning"} /><StatusPill label={journey.hasAnomaly ? "存在异常" : "无明显异常"} tone={journey.hasAnomaly ? "error" : "neutral"} /></div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">总时长 / 有效时长</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatDuration(journey.totalDurationMs)} / {formatDuration(journey.effectiveDurationMs)}</div><div className="mt-1 text-xs text-slate-500">{formatRelativeTime(journey.startedAt)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-xs text-slate-400">起止时间</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTimeFull(journey.startedAt)} 至 {formatDateTimeFull(journey.endedAt)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-xs text-slate-400">应用与动作</div><div className="mt-2 text-sm font-semibold text-slate-900">{journey.application.name} · {journey.pageTemplate} · {journey.pageTitle}</div><div className="mt-1 text-sm text-slate-500">{journey.businessActionType}</div></div>
          </div>
        </SectionCard>

        <JourneyAgent2AnalysisCard
          analysis={aiAnalysis}
          action={<RunAgent2Button tenantSlug={tenant.slug} journeyId={journey.id} />}
          fallback={{
            summary: journey.aiSummaryShort,
            goal: journey.aiGoalAnalysis,
            anomaly: journey.aiAnomalyAnalysis,
          }}
        />
      </div>

      <SectionCard title="汇总标签与归档" description="旅程标签、用户标签和研究项目在这里统一管理；相同标签只展示一次。" action={<Link href="#journey-analysis" className={cn(buttonVariants({ variant: "outline" }), "h-8 px-3")}>查看时间轴</Link>}>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr_1fr]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 text-xs text-slate-400">状态与来源</div>
            <div className="flex flex-wrap gap-2">
              <StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={journey.resultStatus === "FAILED" ? "error" : journey.resultStatus === "COMPLETED" ? "success" : "warning"} />
              <StatusPill label={journey.hasAnomaly ? "存在异常" : "无明显异常"} tone={journey.hasAnomaly ? "error" : "neutral"} />
              <StatusPill label={journey.source === "REAL" ? "真实聚合" : "Demo fallback"} tone={journey.source === "REAL" ? "info" : "neutral"} />
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">合并标签</div>
              <AssignTagDialog
                entityId={journey.id}
                entityType="journeys"
                tenantSlug={tenant.slug}
                title="为旅程添加标签"
                description="新增后会进入汇总标签区；若与用户标签同名，只展示一次。"
                tags={availableJourneyTags}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {mergedTags.length === 0 ? <span className="text-sm text-slate-500">暂无标签</span> : mergedTags.map((tag) => <TagChip key={tag.name} label={tag.name} color={tag.color} />)}
            </div>
            <div className="mt-3 text-xs leading-5 text-slate-500">已合并：{journey.journeyTags.length} 个旅程标签 / {journey.user.userTags.length} 个用户标签</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">研究项目</div>
              <AddToProjectDialog
                compact
                tenantSlug={tenant.slug}
                journeyId={journey.id}
                projects={projects}
                currentProjectIds={currentProjectIds}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {journey.projectJourneys.length === 0 ? <span className="text-sm text-slate-500">尚未归档到研究项目</span> : journey.projectJourneys.map(({ project }) => <TagChip key={project.id} label={project.name} />)}
            </div>
          </div>
        </div>
      </SectionCard>

      <Suspense fallback={<DetailLoadingShell title="正在加载旅程完整分析面板" subtitle="回放区、证据区和研究项目区域会在首屏基础信息之后继续返回。" sections={2} />}>
        <JourneyDetailAnalysis tenantSlug={tenant.slug} journeyId={journey.id} />
      </Suspense>

      <Agent2ModelLogs logs={agent2ModelLogs} />
    </div>
  );
}
