import Link from "next/link";

import { CreateApplicationDialog } from "@/components/applications/create-application-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { applicationStatusLabelMap, getTenantApplications } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getApplicationStatusTone(status: string) {
  if (status === "ACTIVE" || status === "CONNECTED") {
    return "success" as const;
  }
  if (status === "PENDING") {
    return "warning" as const;
  }
  if (status === "DEGRADED") {
    return "warning" as const;
  }
  return "neutral" as const;
}

export default async function TenantApplicationsPage({ params }: { params: { tenantId: string } }) {
  const { tenant, applications } = await getTenantApplications(params.tenantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="应用列表"
        subtitle="创建和管理当前租户下的应用空间，为真实数据接入准备 App Key 与接入 Token。"
        actions={<CreateApplicationDialog tenantSlug={tenant.slug} />}
      />

      {applications.length === 0 ? (
        <SectionCard title="暂无应用" description="当前租户还没有应用空间，先创建一个空白应用再配置 SDK 接入。">
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-slate-900">创建第一个应用</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                应用创建后会生成唯一 App Key 和接入 Token，后续旅程、用户、标签都会归属到该应用。
              </p>
            </div>
            <CreateApplicationDialog tenantSlug={tenant.slug} />
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {applications.map((application) => (
            <SectionCard
              key={application.id}
              title={application.name}
              description={`${application.host} · ${application.appKey}`}
            >
              <div className="space-y-4">
                <p className="text-sm leading-7 text-slate-600">{application.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-400">接入状态</div>
                    <div className="mt-2">
                      <StatusPill label={applicationStatusLabelMap[application.status]} tone={getApplicationStatusTone(application.status)} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-400">最近上报时间</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {application.lastReportedAt ? formatRelativeTime(application.lastReportedAt) : "尚未上报"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {application.lastReportedAt ? formatDateTimeFull(application.lastReportedAt) : "等待 SDK 初始化或首条旅程上报"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-400">活跃用户数</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{application.activeUserCount}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs text-slate-400">旅程数</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{application._count.journeys}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">创建于 {formatDateTimeFull(application.createdAt)}</div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tenants/${tenant.slug}/integration?appId=${application.id}`}
                      className={cn(buttonVariants({ variant: "ghost" }), "h-8")}
                    >
                      接入配置
                    </Link>
                    <Link
                      href={`/tenants/${tenant.slug}/applications/${application.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "h-8")}
                    >
                      应用详情
                    </Link>
                  </div>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
