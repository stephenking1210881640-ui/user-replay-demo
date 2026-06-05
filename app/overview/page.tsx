import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { getOverviewData, journeyStatusLabelMap } from "@/lib/data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const overview = await getOverviewData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="平台概览"
        subtitle="从总量、异常、研究项目和活跃用户四个层面，快速判断当前 Demo 样本是否健康可用。"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="最近 7 天旅程数" value={overview.metrics.last7dJourneyCount} subtext="概览样本池规模" />
        <KpiCard label="成功完成数" value={overview.metrics.successCount} subtext={`成功率 ${overview.metrics.successRate}%`} />
        <KpiCard label="异常旅程数" value={overview.metrics.anomalyCount} subtext="包含失败请求或阻断异常" />
        <KpiCard label="未完成数" value={overview.metrics.unfinishedCount} subtext="中途放弃与仅浏览退出" />
      </div>

      <SectionCard title="AI 洞察提示卡" description="基于最近 7 天样本自动生成的运营提示。">
        <div className="rounded-2xl border border-violet-200 bg-[var(--ai-purple-light)] p-5 text-sm leading-7 text-slate-800">
          {overview.insight}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="最近异常旅程" description="优先回看结果异常或未完成的代表性样本。">
          <div className="space-y-3">
            {overview.recentAnomalyJourneys.map((journey) => (
              <Link
                key={journey.id}
                href={`/journeys/${journey.id}`}
                className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {journey.journeyCode} · {journey.user.externalId}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{formatDateTimeFull(journey.startedAt)}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusPill
                      label={journeyStatusLabelMap[journey.resultStatus]}
                      tone={journey.hasAnomaly ? "error" : "warning"}
                    />
                    {journey.hasAnomaly ? <StatusPill label="异常" tone="error" /> : null}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {journey.journeyTags.map(({ tag }) => (
                    <TagChip key={tag.id} label={tag.name} color={tag.color} />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="最近研究项目" description="查看当前平台里已建立的研究任务容器。">
            <div className="space-y-3">
              {overview.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {project.focusTarget || project.focusArea} · {project.focusFeature || project.focusArea}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{project._count.projectJourneys} 条旅程</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{project.goal}</p>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="最近活跃用户" description="用于快速进入用户画像与最近旅程。">
            <div className="space-y-3">
              {overview.recentActiveUsers.map((user) => (
                <Link
                  key={user.id}
                  href={`/users/${user.id}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {user.externalId} · {user.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {user.deviceType} · {user.os} · 最近活跃 {formatRelativeTime(user.lastActiveAt)}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{user._count.journeys} 条旅程</div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/journeys" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
          查看全部旅程
        </Link>
      </div>
    </div>
  );
}
