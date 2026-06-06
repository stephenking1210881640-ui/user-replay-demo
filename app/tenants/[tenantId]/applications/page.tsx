import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { applicationStatusLabelMap, getTenantApplications } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantApplicationsPage({ params }: { params: { tenantId: string } }) {
  const { tenant, applications } = await getTenantApplications(params.tenantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="应用列表"
        subtitle="查看应用接入状态、活跃用户和旅程产出情况。"
      />

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
                    <StatusPill label={applicationStatusLabelMap[application.status]} tone={application.status === "DEGRADED" ? "warning" : "success"} />
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-400">最近上报时间</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{formatRelativeTime(application.lastReportedAt ?? application.createdAt)}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDateTimeFull(application.lastReportedAt ?? application.createdAt)}</div>
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
                <Link
                  href={`/tenants/${tenant.slug}/applications/${application.id}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-8")}
                >
                  查看接入详情
                </Link>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
