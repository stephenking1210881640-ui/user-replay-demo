import Link from "next/link";

import { AddToProjectDialog } from "@/components/journeys/add-to-project-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantJourneys, journeyStatusLabelMap } from "@/lib/tenant-data";
import { formatDateTimeFull, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantJourneysPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { tenant, journeys, userTags, journeyTags, projects } = await getTenantJourneys(params.tenantId, searchParams);
  const anomalyRate = journeys.length ? `${Math.round((journeys.filter((journey) => journey.hasAnomaly).length / journeys.length) * 100)}%` : "0%";
  const completedCount = journeys.filter((journey) => journey.resultStatus === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="用户旅程" subtitle="查看用户的真实使用旅程，并按当前工作区做筛选分析。" />

      <form className="grid gap-3 rounded-2xl border border-[var(--border-light)] bg-white p-4 shadow-[var(--card-shadow)] lg:grid-cols-4">
        <select name="range" defaultValue={typeof searchParams.range === "string" ? searchParams.range : "7d"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <input name="userId" defaultValue={typeof searchParams.userId === "string" ? searchParams.userId : ""} placeholder="用户 ID" className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
        <select name="userTag" defaultValue={typeof searchParams.userTag === "string" ? searchParams.userTag : "all"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="all">所有用户标签</option>
          {userTags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <select name="journeyTag" defaultValue={typeof searchParams.journeyTag === "string" ? searchParams.journeyTag : "all"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="all">所有旅程标签</option>
          {journeyTags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <input name="pageTemplate" defaultValue={typeof searchParams.pageTemplate === "string" ? searchParams.pageTemplate : ""} placeholder="页面模板，例如 /checkout" className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
        <select name="resultStatus" defaultValue={typeof searchParams.resultStatus === "string" ? searchParams.resultStatus : "all"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="all">全部状态</option>
          <option value="COMPLETED">已完成</option>
          <option value="ABANDONED">未完成</option>
          <option value="FAILED">异常</option>
          <option value="BROWSING">仅浏览退出</option>
        </select>
        <select name="hasAnomaly" defaultValue={typeof searchParams.hasAnomaly === "string" ? searchParams.hasAnomaly : "all"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="all">全部异常情况</option>
          <option value="true">仅显示异常旅程</option>
          <option value="false">仅显示正常旅程</option>
        </select>
        <div className="flex gap-3">
          <input name="businessActionType" defaultValue={typeof searchParams.businessActionType === "string" ? searchParams.businessActionType : ""} placeholder="业务动作类型" className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
          <button type="submit" className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
            应用筛选
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        <KpiCard label="符合条件旅程数" value={journeys.length} subtext="当前筛选结果" />
        <KpiCard label="异常旅程占比" value={anomalyRate} subtext="快速识别高风险旅程占比" />
        <KpiCard label="已完成旅程数" value={completedCount} subtext="已完成目标动作的旅程数" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-white shadow-[var(--card-shadow)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="px-4 text-slate-500">旅程与用户</TableHead>
              <TableHead className="px-4 text-slate-500">应用 / 时长</TableHead>
              <TableHead className="px-4 text-slate-500">状态与异常</TableHead>
              <TableHead className="px-4 text-slate-500">AI 摘要与标签</TableHead>
              <TableHead className="px-4 text-slate-500">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {journeys.map((journey) => (
              <TableRow key={journey.id}>
                <TableCell className="px-4 align-top">
                  <div className="font-semibold text-slate-900">{journey.journeyCode}</div>
                  <div className="mt-1 text-sm text-slate-500">{journey.user.externalId}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTimeFull(journey.startedAt)}</div>
                  <div className="mt-2">
                    <StatusPill label={journey.source === "REAL" ? "真实聚合" : "Demo fallback"} tone={journey.source === "REAL" ? "info" : "neutral"} />
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top text-sm text-slate-600">
                  <div>{journey.application.name}</div>
                  <div className="mt-1">总时长 {formatDuration(journey.totalDurationMs)}</div>
                  <div className="mt-1 text-xs text-slate-400">{journey.pageCount} 页 / {journey.keyActionCount} 个关键动作</div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={journey.resultStatus === "COMPLETED" ? "success" : journey.resultStatus === "FAILED" ? "error" : "warning"} />
                    <StatusPill label={journey.hasAnomaly ? "高危异常" : "无明显异常"} tone={journey.hasAnomaly ? "error" : "neutral"} />
                  </div>
                </TableCell>
                <TableCell className="max-w-[420px] px-4 align-top whitespace-normal">
                  <p className="text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {journey.journeyTags.map(({ tag }) => (
                      <TagChip key={tag.id} label={tag.name} color={tag.color} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <Link href={`/tenants/${tenant.slug}/journeys/${journey.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
                      查看详情
                    </Link>
                    <AddToProjectDialog compact tenantSlug={tenant.slug} journeyId={journey.id} projects={projects} currentProjectIds={journey.projectJourneys.map(({ project }) => project.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
