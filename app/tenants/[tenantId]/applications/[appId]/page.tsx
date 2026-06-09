import Link from "next/link";
import { notFound } from "next/navigation";

import { ApplicationAiProfileSection } from "@/components/applications/application-ai-profile-section";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { applicationStatusLabelMap, getTenantApplicationDetail, journeyStatusLabelMap } from "@/lib/tenant-data";
import { formatDateTimeFull, formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getApplicationStatusTone(status: string) {
  if (status === "ACTIVE" || status === "CONNECTED") {
    return "success" as const;
  }
  if (status === "PENDING" || status === "DEGRADED") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function getJourneyStatusTone(status: string, hasAnomaly: boolean) {
  if (hasAnomaly || status === "FAILED") return "error" as const;
  if (status === "COMPLETED") return "success" as const;
  return "warning" as const;
}

function getModelLogStatusTone(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "error" as const;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.application.name} 接入详情`}
        subtitle={detail.application.host}
        actions={
          <Link
            href={`/tenants/${detail.tenant.slug}/applications`}
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            返回应用列表
          </Link>
        }
      />

      <SectionCard title="应用总览" description="应用状态、接入标识、最近数据产出与研究沉淀统一在这里查看。">
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
            subtext={detail.application.lastReportedAt ? formatDateTimeFull(detail.application.lastReportedAt) : "等待 SDK 初始化或首条事件上报"}
          />
          <KpiCard label="最近 24 小时旅程 / 活跃用户" value={`${detail.journeyCount24h} / ${detail.activeUsers24h}`} subtext="用于快速判断接入是否持续产出有效数据" />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="最近旅程"
          description="当前应用最近生成的旅程，用于快速判断接入后是否产出可分析数据。"
          action={
            <Link href={`/tenants/${detail.tenant.slug}/journeys`} className="text-xs font-medium text-[var(--primary)]">
              全部旅程
            </Link>
          }
        >
          {detail.recentJourneys.length ? (
            <div className="space-y-3">
              {detail.recentJourneys.map((journey) => (
                <Link
                  key={journey.id}
                  href={`/tenants/${detail.tenant.slug}/journeys/${journey.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{journey.journeyCode}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {journey.user.externalId} · {formatRelativeTime(journey.startedAt)} · {formatDuration(journey.totalDurationMs)}
                      </div>
                    </div>
                    <StatusPill label={journeyStatusLabelMap[journey.resultStatus]} tone={getJourneyStatusTone(journey.resultStatus, journey.hasAnomaly)} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              当前应用暂无旅程。完成 SDK 接入并访问目标应用后，这里会展示最近聚合出的旅程。
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="最近研究项目"
          description="围绕当前应用沉淀的研究项目。"
          action={
            <Link href={`/tenants/${detail.tenant.slug}/projects`} className="text-xs font-medium text-[var(--primary)]">
              全部研究项目
            </Link>
          }
        >
          {detail.recentProjects.length ? (
            <div className="space-y-3">
              {detail.recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/tenants/${detail.tenant.slug}/projects/${project.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{project.goal}</p>
                    </div>
                    <StatusPill label={`${project._count.projectJourneys} 条旅程`} tone="info" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              当前应用还没有关联的研究项目。接入真实旅程后，可从旅程列表或详情页归档到研究项目。
            </div>
          )}
        </SectionCard>
      </div>

      <ApplicationAiProfileSection
        tenantSlug={detail.tenant.slug}
        applicationId={detail.application.id}
        applicationHost={detail.application.host}
        appKey={detail.application.appKey}
        ingestToken={detail.application.ingestToken}
        profile={detail.application.aiProfiles[0] ?? null}
      />

      <SectionCard title="接入 Token" description="当前应用的服务端接入凭证。SDK 代码生成区会自动引用这里的 App Key 和 Ingest Token。">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">App Key</div>
            <div className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">{detail.application.appKey}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ingest Token</div>
            <div className="mt-2 break-all font-mono text-sm text-slate-900">{detail.application.ingestToken ?? "当前应用尚未生成接入 Token"}</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Token 仅用于目标应用向平台上报浏览器事件。线上环境需要同步配置到目标应用的环境变量或部署配置中。
        </p>
      </SectionCard>

      <SectionCard title="Agent1 模型交互日志" description="记录最近 3 次 Agent1 调用模型时发送的 prompt 和模型原始返回，便于排查模型理解结果。">
        {detail.application.agent1ModelLogs.length ? (
          <div className="space-y-3">
            {detail.application.agent1ModelLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{log.provider} / {log.model}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {formatDateTimeFull(log.createdAt)} · {log.promptVersion} · {log.latencyMs ? `${(log.latencyMs / 1000).toFixed(1)}s` : "未记录耗时"}
                    </div>
                  </div>
                  <StatusPill label={log.status} tone={getModelLogStatusTone(log.status)} />
                </div>

                {log.errorMessage ? (
                  <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{log.errorMessage}</div>
                ) : null}

                <details className="mt-3 rounded-xl bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">查看输入 prompt 与模型返回</summary>
                  <div className="mt-3 grid gap-3 xl:grid-cols-3">
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">System Prompt</div>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{log.inputSystemPrompt}</pre>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">User Prompt</div>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{log.inputUserPrompt}</pre>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Response</div>
                      <pre className="max-h-72 overflow-auto rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{log.responseText ?? "无模型文本返回"}</pre>
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            暂无模型交互日志。点击“AI 理解应用”并成功触发模型后，这里会展示最近的输入 prompt 和模型返回。
          </div>
        )}
      </SectionCard>
    </div>
  );
}
