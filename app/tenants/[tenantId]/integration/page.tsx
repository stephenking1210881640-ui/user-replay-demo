import Link from "next/link";
import { Code2, PlugZap } from "lucide-react";

import { CreateApplicationDialog } from "@/components/applications/create-application-dialog";
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

export default async function TenantIntegrationPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams?: { appId?: string };
}) {
  const { tenant, applications, journeyCount24h, activeUsers24h, aggregationResult } = await getTenantIntegrationOverview(params.tenantId);
  const selectedApp = applications.find((application) => application.id === searchParams?.appId) ?? applications[0];
  const allLogs = applications.flatMap((application) => application.integrationLogs).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
  const selectedLogs = selectedApp?.integrationLogs ?? [];
  const selectedBrowserEvents = selectedApp?.browserEvents ?? [];

  const codeSnippet = selectedApp
    ? `import { createJourneyCollector } from "@user-replay/browser-collector";

const collector = createJourneyCollector({
  appKey: "${selectedApp.appKey}",
  ingestToken: "${selectedApp.ingestToken ?? "请重新生成接入 Token"}",
  endpoint: "${productionIngestEndpoint}",
  host: "${selectedApp.host}",
  redactKeys: ["email", "phone"]
});

collector.identify("user_123", { role: "admin" });
collector.track("integration_verify_clicked");`
    : "<!-- 暂无应用可生成接入代码 -->";

  return (
    <div className="space-y-6">
      <PageHeader
        title="租户接入配置"
        subtitle="按应用查看 App Key、接入状态、SDK 片段与实时校验日志。"
        actions={<CreateApplicationDialog tenantSlug={tenant.slug} />}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="租户应用数" value={applications.length} subtext="当前租户已接入应用" />
        <KpiCard label="最近 24 小时旅程数" value={journeyCount24h} subtext="用来判断采集是否持续产出" />
        <KpiCard label="最近 24 小时活跃用户数" value={activeUsers24h} subtext="结合旅程数判断租户活跃度" />
        <KpiCard label="已启用应用" value={applications.filter((application) => application.status === "ACTIVE" || application.status === "CONNECTED").length} subtext="接入健康应用数" />
      </div>

      <SectionCard title="真实事件聚合状态" description="页面刷新时会尝试把未聚合的 BrowserEvent 转成 Journey。">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">本次生成真实旅程</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{aggregationResult.createdJourneys}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-400">本次关联原始事件</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{aggregationResult.linkedEvents}</div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="应用接入总览" description="每个应用都在当前租户下独立维护自己的接入状态与数据产出。">
          {applications.length ? (
            <div className="space-y-3">
              {applications.map((application) => (
                <Link
                  key={application.id}
                  href={`/tenants/${tenant.slug}/integration?appId=${application.id}`}
                  className={cn(
                    "block rounded-2xl border p-4 transition hover:bg-slate-50",
                    selectedApp?.id === application.id ? "border-slate-900 bg-slate-50" : "border-slate-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{application.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{application.host}</div>
                    </div>
                    <StatusPill label={applicationStatusLabelMap[application.status]} tone={getApplicationStatusTone(application.status)} />
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    App Key：<span className="font-mono">{application.appKey}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {application.lastReportedAt ? `最近上报 ${formatRelativeTime(application.lastReportedAt)}` : "尚未上报"} · 原始事件 {application._count.browserEvents} · 旅程 {application._count.journeys}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="font-semibold text-slate-900">暂无可接入应用</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">先创建一个应用，系统会生成 App Key 和接入 Token。</p>
              <div className="mt-4">
                <CreateApplicationDialog tenantSlug={tenant.slug} />
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="应用接入代码" description={selectedApp ? `当前应用：${selectedApp.name}` : "创建应用后生成接入片段。"} action={<Code2 className="h-4 w-4 text-slate-400" />}>
          {selectedApp ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">App Key</div>
                <div className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">{selectedApp.appKey}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">Host</div>
                <div className="mt-2 break-all text-sm font-semibold text-slate-900">{selectedApp.host}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">接入状态</div>
                <div className="mt-2">
                  <StatusPill label={applicationStatusLabelMap[selectedApp.status]} tone={getApplicationStatusTone(selectedApp.status)} />
                </div>
              </div>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-2xl bg-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
              <span>Browser Collector SDK</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200">application scoped</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-7 text-slate-100">{codeSnippet}</pre>
          </div>
          <div className="mt-4">
            {selectedApp ? (
              <Link href={`/tenants/${tenant.slug}/applications/${selectedApp.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
                查看应用详情
              </Link>
            ) : (
              <Link href={`/tenants/${tenant.slug}/applications`} className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
                查看应用列表
              </Link>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="SDK 安装说明" description="预留真实 SDK 接入文档区，当前 Demo 展示最小接入流程。">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1. 安装 SDK", "在应用前端安装采集 SDK，或通过 script 片段直接引入。"],
            ["2. 初始化应用", "使用当前应用的 App Key 与 Ingest Token 初始化采集配置。"],
            ["3. 校验上报", "打开页面并触发一次旅程，确认实时校验日志出现接收记录。"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-900">{title}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {selectedApp ? (
        <SectionCard title="当前应用最近校验日志" description="用于验证该应用是否已经完成 SDK 初始化与事件上报。">
          {selectedLogs.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="px-4 text-slate-500">时间</TableHead>
                  <TableHead className="px-4 text-slate-500">来源</TableHead>
                  <TableHead className="px-4 text-slate-500">状态</TableHead>
                  <TableHead className="px-4 text-slate-500">消息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="px-4 font-mono text-xs text-slate-500">{formatDateTimeFull(log.createdAt)}</TableCell>
                    <TableCell className="px-4 text-sm text-slate-700">{log.source}</TableCell>
                    <TableCell className="px-4">
                      <StatusPill label={log.status} tone={log.level === "error" ? "error" : log.level === "warn" ? "warning" : "success"} />
                    </TableCell>
                    <TableCell className="max-w-[520px] px-4 whitespace-normal text-sm leading-6 text-slate-700">{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              当前应用暂无校验日志。完成 SDK 初始化后，首条 init / identify / journey 事件会出现在这里。
            </div>
          )}
        </SectionCard>
      ) : null}

      {selectedApp ? (
        <SectionCard title="当前应用最近原始事件" description="展示由 /api/ingest/browser-events 真实写入的浏览器事件。">
          {selectedBrowserEvents.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="px-4 text-slate-500">接收时间</TableHead>
                  <TableHead className="px-4 text-slate-500">事件类型</TableHead>
                  <TableHead className="px-4 text-slate-500">Session</TableHead>
                  <TableHead className="px-4 text-slate-500">用户</TableHead>
                  <TableHead className="px-4 text-slate-500">页面 / 请求</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBrowserEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="px-4 font-mono text-xs text-slate-500">{formatDateTimeFull(event.receivedAt)}</TableCell>
                    <TableCell className="px-4">
                      <StatusPill label={event.eventType} tone={event.eventType === "ui_error" ? "error" : event.eventType === "network_request" ? "info" : "neutral"} />
                    </TableCell>
                    <TableCell className="px-4 font-mono text-xs text-slate-600">{event.sessionId}</TableCell>
                    <TableCell className="px-4 text-sm text-slate-700">{event.userId ?? event.anonymousId ?? "-"}</TableCell>
                    <TableCell className="max-w-[520px] px-4 whitespace-normal text-sm leading-6 text-slate-700">
                      {event.pageTitle ? <span className="font-medium text-slate-900">{event.pageTitle}</span> : null}
                      <div className="break-all text-xs text-slate-500">{event.pageUrl ?? event.requestUrl ?? "-"}</div>
                      {event.requestStatus ? <div className="mt-1 text-xs text-slate-400">HTTP {event.requestStatus}</div> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              当前应用还没有真实入库的原始事件。调用 ingest API 后，这里会展示最近接收的 page_view、ui_click、network_request 等事件。
            </div>
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="实时数据校验日志" description="按租户聚合展示最近一批接收、聚合与校验结果。" action={<PlugZap className="h-4 w-4 text-slate-400" />}>
        {allLogs.length ? (
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
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            当前租户暂无实时校验日志。创建应用并接入 SDK 后，可在这里查看跨应用的接收与校验结果。
          </div>
        )}
      </SectionCard>
    </div>
  );
}
