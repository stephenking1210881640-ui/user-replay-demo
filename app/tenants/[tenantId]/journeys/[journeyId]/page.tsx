import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { JourneyDetailAnalysis } from "@/components/journeys/journey-detail-analysis";
import { PageHeader } from "@/components/layout/page-header";
import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { getTenantJourneyDetailShell, journeyStatusLabelMap } from "@/lib/tenant-data";
import { formatDuration, formatRelativeTime } from "@/lib/format";
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

  const { tenant, journey } = detail;

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
        <SectionCard title="旅程基础信息" description="首屏先稳定回答这是谁、何时发生、结果如何。">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">旅程 ID</div><div className="mt-2 font-mono text-sm font-semibold text-slate-900">{journey.journeyCode}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">用户 ID</div><div className="mt-2 font-mono text-sm font-semibold text-slate-900">{journey.user.externalId}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">状态</div><div className="mt-2 flex flex-wrap gap-2"><StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={journey.resultStatus === "FAILED" ? "error" : journey.resultStatus === "COMPLETED" ? "success" : "warning"} /><StatusPill label={journey.hasAnomaly ? "存在异常" : "无明显异常"} tone={journey.hasAnomaly ? "error" : "neutral"} /></div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">时间信息</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatDuration(journey.totalDurationMs)} · 有效 {formatDuration(journey.effectiveDurationMs)}</div><div className="mt-1 text-xs text-slate-500">{formatRelativeTime(journey.startedAt)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-xs text-slate-400">应用与动作</div><div className="mt-2 text-sm font-semibold text-slate-900">{journey.application.name} · {journey.pageTemplate} · {journey.pageTitle}</div><div className="mt-1 text-sm text-slate-500">{journey.businessActionType}</div></div>
          </div>
        </SectionCard>

        <SectionCard title="AI 总结" description="首屏直接给出这条旅程的统一解释。">
          <div className="space-y-3">
            <div className="rounded-2xl border border-violet-200 bg-[var(--ai-purple-light)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ai-purple)]">一句话总结</div>
              <p className="mt-2 text-sm leading-7 text-slate-800">{journey.aiSummaryShort}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">目标达成分析</div>
              <p className="mt-2 text-sm leading-7 font-medium text-slate-900">{journey.aiGoalAnalysis}</p>
            </div>
            <div className={cn("rounded-2xl p-4", journey.hasAnomaly ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}>
              <div className="text-xs opacity-80">异常行为摘要</div>
              <p className="mt-2 text-sm leading-7 font-medium">{journey.aiAnomalyAnalysis}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="时间线入口" description="完整回放区尚在加载时，先提供关键节点与跳转入口。" action={<Link href="#journey-analysis" className={cn(buttonVariants({ variant: "outline" }), "h-8 px-3")}>进入完整分析</Link>}>
          <div className="space-y-3">
            {journey.events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{event.title}</span>
                      <StatusPill label={event.isAnomaly ? "异常节点" : "关键节点"} tone={event.isAnomaly ? "error" : "info"} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{event.description}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">{formatDuration(event.offsetMs)}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="标签与识别" description="即使分析面板还在加载，首屏也能看到旅程归类。">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs text-slate-400">旅程标签</div>
              <div className="flex flex-wrap gap-2">{journey.journeyTags.map(({ tag }) => <TagChip key={tag.id} label={tag.name} color={tag.color} />)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">用户</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{journey.user.name}</div>
              <div className="mt-1 text-sm text-slate-500">{journey.user.externalId}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <Suspense fallback={<DetailLoadingShell title="正在加载旅程完整分析面板" subtitle="回放区、证据区和研究项目区域会在首屏基础信息之后继续返回。" sections={2} />}>
        <JourneyDetailAnalysis tenantSlug={tenant.slug} journeyId={journey.id} />
      </Suspense>
    </div>
  );
}
