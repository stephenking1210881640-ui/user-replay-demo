import Link from "next/link";

import { CreateTenantDialog } from "@/components/tenants/create-tenant-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { getTenantList, tenantPlanLabelMap, tenantStatusLabelMap } from "@/lib/tenant-data";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const tenants = await getTenantList(searchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        title="企业租户"
        subtitle="从平台视角查看所有企业租户，并进入各自独立的数据空间。"
        actions={<CreateTenantDialog />}
      />

      <form className="flex gap-3 rounded-2xl border border-[var(--border-light)] bg-white p-4 shadow-[var(--card-shadow)]">
        <select name="status" defaultValue={typeof searchParams.status === "string" ? searchParams.status : "all"} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
          <option value="all">全部状态</option>
          <option value="ACTIVE">正常运行</option>
          <option value="TRIAL">试用中</option>
          <option value="RISK">重点关注</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
          应用筛选
        </button>
      </form>

      <div className="grid gap-4 xl:grid-cols-2">
        {tenants.map((tenant) => (
          <SectionCard key={tenant.id} title={tenant.name} description={`${tenant.industry} · ${tenant.slug}`}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill label={tenantStatusLabelMap[tenant.status]} tone={tenant.status === "RISK" ? "warning" : "success"} />
                <StatusPill label={tenantPlanLabelMap[tenant.plan]} tone="info" />
              </div>
              <p className="text-sm leading-7 text-slate-600">{tenant.description ?? "当前租户暂未补充描述。"}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">应用数</div><div className="mt-2 text-lg font-semibold text-slate-900">{tenant._count.applications}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">活跃用户数</div><div className="mt-2 text-lg font-semibold text-slate-900">{tenant.activeUserCount}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">旅程数</div><div className="mt-2 text-lg font-semibold text-slate-900">{tenant._count.journeys}</div></div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <div>最近活跃：<span className="font-medium text-slate-900">{formatRelativeTime(tenant.recentActiveAt)}</span></div>
                <Link href={`/tenants/${tenant.slug}/overview`} className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
                  进入租户
                </Link>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
