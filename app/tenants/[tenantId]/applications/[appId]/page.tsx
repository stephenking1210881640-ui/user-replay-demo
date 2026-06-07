import { Code2, PlugZap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applicationStatusLabelMap, getTenantApplicationDetail } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const productionIngestEndpoint = "https://user-replay-demo.vercel.app/api/ingest/browser-events";

function getApplicationStatusTone(status: string) {
  if (status === "ACTIVE" || status === "CONNECTED") {
    return "success" as const;
  }
  if (status === "PENDING" || status === "DEGRADED") {
    return "warning" as const;
  }
  return "neutral" as const;
}

export default async function TenantApplicationDetailPage({
  params,
}: {
  params: { tenantId: string; appId: string };
}) {
  const detail = await getTenantApplicationDetail(params.tenantId, params.appId);

  if (!detail) {
    notFound();
  }

  const codeSnippet = `import { createJourneyCollector } from "@user-replay/browser-collector";

const collector = createJourneyCollector({
  appKey: "${detail.application.appKey}",
  ingestToken: "${detail.application.ingestToken ?? "请重新生成接入 Token"}",
  endpoint: "${productionIngestEndpoint}",
  host: "${detail.application.host}",
  redactKeys: ["email", "phone"]
});

collector.identify("user_123", { role: "admin" });
collector.track("integration_verify_clicked");`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.application.name} 接入详情`}
        subtitle={detail.application.host}
        actions={
          <Link
            href={`/tenants/${detail.tenant.slug}/integration?appId=${detail.application.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            查看接入配置
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard
          label="应用状态"
          value={detail.application.name}
          subtext={detail.application.host}
          accent={<StatusPill label={applicationStatusLabelMap[detail.application.status]} tone={getApplicationStatusTone(detail.application.status)} />}
        />
        <KpiCard label="App Key" value={<span className="font-mono text-lg">{detail.application.appKey}</span>} subtext={`创建于 ${formatDateTimeFull(detail.application.createdAt)}`} />
        <KpiCard
          label="最近上报时间"
          value={detail.application.lastReportedAt ? formatRelativeTime(detail.application.lastReportedAt) : "尚未上报"}
          subtext={detail.application.lastReportedAt ? formatDateTimeFull(detail.application.lastReportedAt) : "等待 SDK 初始化或首条旅程上报"}
        />
        <KpiCard label="最近 24 小时旅程 / 活跃用户" value={`${detail.journeyCount24h} / ${detail.activeUsers24h}`} subtext="用于快速判断接入是否持续产出有效数据" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="接入说明" description="应用维度的采集与分析配置。">
          <div className="space-y-3 text-sm leading-7 text-slate-600">
            <p>{detail.application.description}</p>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ingest Token</div>
              <div className="mt-2 break-all font-mono text-sm text-slate-900">
                {detail.application.ingestToken ?? "当前应用尚未生成接入 Token"}
              </div>
            </div>
            <p>建议在业务脚本前初始化采集 SDK，并在登录后尽快执行用户识别与业务上下文注入。</p>
          </div>
        </SectionCard>

        <SectionCard title="标准接入代码" description="基于当前应用生成的接入片段。" action={<Code2 className="h-4 w-4 text-slate-400" />}>
          <div className="overflow-hidden rounded-2xl bg-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
              <span>Browser Collector SDK</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200">auto collect enabled</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-7 text-slate-100">{codeSnippet}</pre>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="最近研究项目" description="围绕当前应用沉淀的研究项目。">
        {detail.recentProjects.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {detail.recentProjects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="font-semibold text-slate-900">{project.name}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{project.goal}</p>
                <div className="mt-3 text-xs text-slate-400">{project._count.projectJourneys} 条旅程</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            当前应用还没有关联的研究项目。接入真实旅程后，可从旅程列表或详情页归档到研究项目。
          </div>
        )}
      </SectionCard>

      <SectionCard title="实时数据校验日志" description="查看最近一批接收、聚合与校验结果。" action={<PlugZap className="h-4 w-4 text-slate-400" />}>
        {detail.application.integrationLogs.length ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="px-4 text-slate-500">时间</TableHead>
                <TableHead className="px-4 text-slate-500">来源</TableHead>
                <TableHead className="px-4 text-slate-500">状态</TableHead>
                <TableHead className="px-4 text-slate-500">消息</TableHead>
                <TableHead className="px-4 text-slate-500">摘要</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.application.integrationLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="px-4 font-mono text-xs text-slate-500">{formatDateTimeFull(log.createdAt)}</TableCell>
                  <TableCell className="px-4 text-sm text-slate-700">{log.source}</TableCell>
                  <TableCell className="px-4">
                    <StatusPill
                      label={log.status}
                      tone={log.level === "error" ? "error" : log.level === "warn" ? "warning" : "success"}
                    />
                  </TableCell>
                  <TableCell className="max-w-[360px] px-4 whitespace-normal text-sm leading-6 text-slate-700">{log.message}</TableCell>
                  <TableCell className="px-4 text-sm text-slate-500">{log.payloadSummary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            暂无校验日志。完成 SDK 初始化并上报首条事件后，这里会展示接收状态、校验结果和错误提示。
          </div>
        )}
      </SectionCard>
    </div>
  );
}
