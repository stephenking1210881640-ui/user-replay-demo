import Link from "next/link";
import { Code2, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applicationStatusLabelMap, getTenantIntegrationOverview } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantIntegrationPage({ params }: { params: { tenantId: string } }) {
  const { tenant, applications, journeyCount24h, activeUsers24h } = await getTenantIntegrationOverview(params.tenantId);
  const firstApp = applications[0];
  const allLogs = applications.flatMap((application) => application.integrationLogs).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);

  const codeSnippet = firstApp
    ? `<script>
  window.InsightFlow = window.InsightFlow || [];
  InsightFlow.push(["init", {
    appKey: "${firstApp.appKey}",
    recordNetwork: true,
    captureEvidence: true
  }]);
</script>`
    : "<!-- 暂无应用可生成接入代码 -->";

  return (
    <div className="space-y-6">
      <PageHeader
        title="租户接入配置"
        subtitle="集中查看所有应用的接入状态与实时校验日志。"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="租户应用数" value={applications.length} subtext="当前租户已接入应用" />
        <KpiCard label="最近 24 小时旅程数" value={journeyCount24h} subtext="用来判断采集是否持续产出" />
        <KpiCard label="最近 24 小时活跃用户数" value={activeUsers24h} subtext="结合旅程数判断租户活跃度" />
        <KpiCard label="已连接应用" value={applications.filter((application) => application.status === "CONNECTED").length} subtext="接入健康应用数" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="应用接入总览" description="每个应用都在当前租户下独立维护自己的接入状态与数据产出。">
          <div className="space-y-3">
            {applications.map((application) => (
              <Link
                key={application.id}
                href={`/tenants/${tenant.slug}/applications/${application.id}`}
                className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{application.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{application.host}</div>
                  </div>
                  <StatusPill label={applicationStatusLabelMap[application.status]} tone={application.status === "DEGRADED" ? "warning" : "success"} />
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  App Key：<span className="font-mono">{application.appKey}</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  最近上报 {formatRelativeTime(application.lastReportedAt ?? application.createdAt)} · 旅程 {application._count.journeys} · 活跃用户 {application.activeUserCount24h}
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="租户默认接入代码" description="用于快速验证当前租户主应用的最小接入闭环。" action={<Code2 className="h-4 w-4 text-slate-400" />}>
          <div className="overflow-hidden rounded-2xl bg-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
              <span>HTML 代码片段</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200">tenant scoped</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-7 text-slate-100">{codeSnippet}</pre>
          </div>
          <div className="mt-4">
            <Link href={`/tenants/${tenant.slug}/applications`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
              查看全部应用接入详情
            </Link>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="实时数据校验日志" description="按租户聚合展示最近一批接收、聚合与校验结果。" action={<PlugZap className="h-4 w-4 text-slate-400" />}>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="px-4 text-slate-500">时间</TableHead>
              <TableHead className="px-4 text-slate-500">应用</TableHead>
              <TableHead className="px-4 text-slate-500">来源</TableHead>
              <TableHead className="px-4 text-slate-500">状态</TableHead>
              <TableHead className="px-4 text-slate-500">消息</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="px-4 font-mono text-xs text-slate-500">{formatDateTimeFull(log.createdAt)}</TableCell>
                <TableCell className="px-4 text-sm text-slate-700">{applications.find((application) => application.id === log.applicationId)?.name ?? "-"}</TableCell>
                <TableCell className="px-4 text-sm text-slate-700">{log.source}</TableCell>
                <TableCell className="px-4">
                  <StatusPill label={log.status} tone={log.level === "error" ? "error" : log.level === "warn" ? "warning" : "success"} />
                </TableCell>
                <TableCell className="max-w-[420px] px-4 whitespace-normal text-sm leading-6 text-slate-700">{log.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
