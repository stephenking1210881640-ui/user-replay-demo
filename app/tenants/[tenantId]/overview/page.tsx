import Link from "next/link";
import { AlertTriangle, ArrowRight, FolderKanban, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import {
  getTenantOverviewData,
  journeyStatusLabelMap,
  tenantPlanLabelMap,
  tenantStatusLabelMap,
} from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantOverviewPage({ params }: { params: { tenantId: string } }) {
  const overview = await getTenantOverviewData(params.tenantId);
  const anomalyRate = overview.metrics.last7dJourneyCount
    ? Math.round((overview.metrics.anomalyCount / overview.metrics.last7dJourneyCount) * 100)
    : 0;
  const riskCards = [
    {
      title: "异常旅程需要优先回看",
      finding: `${overview.metrics.anomalyCount} 条异常旅程，异常占比 ${anomalyRate}%`,
      reason: "这些旅程通常包含失败请求、错误提示或关键动作阻断。",
      href: `/tenants/${overview.tenant.slug}/journeys?hasAnomaly=true`,
      cta: "查看异常旅程",
      icon: AlertTriangle,
      tone: "rose",
    },
    {
      title: "未完成旅程暴露流失信号",
      finding: `${overview.metrics.unfinishedCount} 条未完成或仅浏览退出`,
      reason: "适合定位犹豫、放弃、页面引导不足和目标未达成原因。",
      href: `/tenants/${overview.tenant.slug}/journeys?resultStatus=ABANDONED`,
      cta: "筛选未完成旅程",
      icon: Search,
      tone: "amber",
    },
    {
      title: "研究项目承接分析闭环",
      finding: `${overview.metrics.projectCount} 个研究项目，${overview.recentProjects.length} 个最近有更新`,
      reason: "把单条旅程加入研究项目，方便沉淀阶段性结论。",
      href: `/tenants/${overview.tenant.slug}/projects`,
      cta: "查看研究项目",
      icon: FolderKanban,
      tone: "blue",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={overview.tenant.name}
        subtitle="旅程概览、风险提醒和下一步入口。"
        actions={
          <>
            <StatusPill label={tenantStatusLabelMap[overview.tenant.status]} tone={overview.tenant.status === "RISK" ? "warning" : "success"} />
            <StatusPill label={tenantPlanLabelMap[overview.tenant.plan]} tone="info" />
            <StatusPill label={overview.tenant.industry} tone="neutral" />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <KpiCard label="最近 7 天旅程数" value={overview.metrics.last7dJourneyCount} subtext={`${overview.metrics.applicationCount} 个应用产生旅程`} />
        <KpiCard label="已完成旅程数" value={overview.metrics.successCount} subtext={`完成率 ${overview.metrics.successRate}%`} />
        <KpiCard label="异常旅程数" value={`${overview.metrics.anomalyCount} / ${anomalyRate}%`} subtext="异常数 / 异常占比" accent={<AlertTriangle className="h-4 w-4 text-rose-500" />} />
        <KpiCard label="活跃用户数" value={overview.metrics.activeUserCount} subtext="近 7 天有行为的用户" />
        <KpiCard label="研究项目数" value={overview.metrics.projectCount} subtext="已建立研究项目" />
      </div>

      <SectionCard title="风险提醒与行动建议" description="先处理影响目标达成的旅程，再进入研究项目沉淀结论。">
        <div className="grid gap-4 xl:grid-cols-3">
          {riskCards.map(({ title, finding, reason, href, cta, icon: Icon, tone }) => (
            <div
              key={title}
              className={cn(
                "rounded-2xl border p-4",
                tone === "rose" && "border-rose-200 bg-rose-50",
                tone === "amber" && "border-amber-200 bg-amber-50",
                tone === "blue" && "border-blue-200 bg-blue-50",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    tone === "rose" && "bg-rose-100 text-rose-700",
                    tone === "amber" && "bg-amber-100 text-amber-700",
                    tone === "blue" && "bg-blue-100 text-blue-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">{title}</div>
                  <div className="mt-2 text-sm font-medium text-slate-800">{finding}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{reason}</p>
                </div>
              </div>
              <Link
                href={href}
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 h-9 w-full justify-between bg-white/70 px-3")}
              >
                {cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          title="最近异常旅程"
          description="从这里进入回放详情。"
          action={
            <Link href={`/tenants/${overview.tenant.slug}/journeys?hasAnomaly=true`} className="text-xs font-medium text-[var(--primary)]">
              全部异常
            </Link>
          }
        >
          <div className="space-y-3">
            {overview.recentAnomalyJourneys.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                最近 7 天暂无异常旅程。
              </div>
            ) : (
              overview.recentAnomalyJourneys.slice(0, 3).map((journey) => (
                <Link
                  key={journey.id}
                  href={`/tenants/${overview.tenant.slug}/journeys/${journey.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{journey.journeyCode}</div>
                      <div className="mt-1 text-xs text-slate-400">{journey.user.externalId} · {formatDateTimeFull(journey.startedAt)}</div>
                    </div>
                    <StatusPill
                      label={journeyStatusLabelMap[journey.resultStatus]}
                      tone={journey.hasAnomaly ? "error" : "warning"}
                    />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {journey.journeyTags.slice(0, 2).map(({ tag }) => (
                      <TagChip key={tag.id} label={tag.name} color={tag.color} />
                    ))}
                  </div>
                </Link>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="最近研究项目"
          description="从旅程进入研究结论。"
          action={
            <Link href={`/tenants/${overview.tenant.slug}/projects`} className="text-xs font-medium text-[var(--primary)]">
              全部研究项目
            </Link>
          }
        >
          <div className="space-y-3">
            {overview.recentProjects.slice(0, 3).map((project) => (
              <Link
                key={project.id}
                href={`/tenants/${overview.tenant.slug}/projects/${project.id}`}
                className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{project.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {project.focusTarget || project.focusArea}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{project._count.projectJourneys} 条</div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{project.goal}</p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="最近活跃用户"
          description="进入用户画像和最近旅程。"
          action={
            <Link href={`/tenants/${overview.tenant.slug}/users`} className="text-xs font-medium text-[var(--primary)]">
              全部用户
            </Link>
          }
        >
          <div className="space-y-3">
            {overview.recentActiveUsers.slice(0, 3).map((user) => (
              <Link
                key={user.id}
                href={`/tenants/${overview.tenant.slug}/users/${user.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>{user.externalId}</span>
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-500">{user.name} · {formatRelativeTime(user.lastActiveAt)}</div>
                </div>
                <div className="shrink-0 text-xs text-slate-400">{user._count.journeys} 条</div>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
