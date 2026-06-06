import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { ProjectDetailSections } from "@/components/projects/project-detail-sections";
import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { getTenantProjectDetailShell } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantProjectDetailPage({
  params,
}: {
  params: { tenantId: string; projectId: string };
}) {
  const detail = await getTenantProjectDetailShell(params.tenantId, params.projectId);

  if (!detail) {
    notFound();
  }

  const { tenant, project } = detail;
  const headlineFinding = project.findings[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        subtitle={project.goal}
        actions={
          <>
            <Link href={`/tenants/${tenant.slug}/projects`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              返回研究项目列表
            </Link>
            <Link href={`/tenants/${tenant.slug}/journeys`} className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
              去旅程列表选择
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="研究项目概览" description="优先呈现研究目标、关注对象和旅程规模。">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">研究项目编号</div><div className="mt-2 font-mono text-sm font-semibold text-slate-900">{project.projectCode ?? "未编号"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">负责人</div><div className="mt-2 text-sm font-semibold text-slate-900">{project.ownerName || "未指定负责人"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">关注对象</div><div className="mt-2 text-sm font-semibold text-slate-900">{project.focusTarget || project.focusArea || "未指定关注对象"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">功能点</div><div className="mt-2 text-sm font-semibold text-slate-900">{project.focusFeature || project.focusArea || "未指定功能点"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">旅程数</div><div className="mt-2 text-sm font-semibold text-slate-900">{project._count.projectJourneys} 条</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">最近更新</div><div className="mt-2 text-sm font-semibold text-slate-900">{formatRelativeTime(project.updatedAt)}</div><div className="mt-1 text-xs text-slate-500">{formatDateTimeFull(project.createdAt)} 创建</div></div>
          </div>
        </SectionCard>

        <SectionCard title="研究结论摘要" description="即使下方内容还在加载，首屏也先交付可读结论。">
          <div className="space-y-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">研究目标</div>
              <p className="mt-2 text-sm leading-7 text-slate-800">{project.goal}</p>
            </div>
            {headlineFinding ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{headlineFinding.title}</div>
                  <StatusPill label={headlineFinding.category} tone={headlineFinding.category === "TECHNICAL" ? "error" : headlineFinding.category === "INTERACTION" ? "warning" : "info"} />
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{headlineFinding.summary}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前研究项目还没有阶段性研究结论，建议先纳入 2 到 3 条核心旅程。
              </div>
            )}
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">研究项目说明</div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{project.description || "当前研究项目尚未补充说明。"}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <Suspense fallback={<DetailLoadingShell title="正在加载研究项目详情" subtitle="旅程列表、筛选条件和候选旅程会在首屏概览之后继续返回。" sections={3} />}>
        <ProjectDetailSections tenantSlug={tenant.slug} projectId={project.id} />
      </Suspense>
    </div>
  );
}
