import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";
import { SectionCard } from "@/components/shared/section-card";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { UserDetailSections } from "@/components/users/user-detail-sections";
import { getTenantUserDetailShell } from "@/lib/tenant-data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function TenantUserDetailPage({ params }: { params: { tenantId: string; userId: string } }) {
  const detail = await getTenantUserDetailShell(params.tenantId, params.userId);

  if (!detail) {
    notFound();
  }

  const { tenant, user } = detail;
  const latestJourney = user.journeys[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.externalId} · ${user.name}`}
        subtitle={`最近活跃 ${formatRelativeTime(user.lastActiveAt)}`}
        actions={
          <>
            <Link href={`/tenants/${tenant.slug}/users`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              返回用户列表
            </Link>
            {latestJourney ? (
              <Link href={`/tenants/${tenant.slug}/journeys/${latestJourney.id}`} className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>
                播放最新旅程
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="用户概览" description="优先展示身份、活跃度与最近旅程入口。">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">用户 ID</div>
              <div className="mt-2 font-mono text-sm font-semibold text-slate-900">{user.externalId}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">最近活跃</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTimeFull(user.lastActiveAt)}</div>
              <div className="mt-1 text-xs text-slate-500">{formatRelativeTime(user.lastActiveAt)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">设备 / 系统</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{user.deviceType} · {user.os}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">旅程数</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{user._count.journeys} 条</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="标签与最近旅程" description="首屏展示用户标签和最近旅程 AI 摘要。">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs text-slate-400">标签</div>
              <div className="flex flex-wrap gap-2">
                {user.userTags.length === 0 ? <span className="text-sm text-slate-500">当前用户还没有标签。</span> : user.userTags.map(({ tag }) => <TagChip key={tag.id} label={tag.name} color={tag.color} />)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">最近旅程 AI 摘要</div>
              {latestJourney ? (
                <>
                  <div className="mt-2 text-sm font-semibold text-slate-900">{latestJourney.journeyCode} · {latestJourney.title}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{latestJourney.aiSummaryShort}</p>
                </>
              ) : (
                <p className="mt-2 text-sm leading-7 text-slate-500">当前用户暂时还没有可展示的旅程。</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <Suspense fallback={<DetailLoadingShell title="正在加载用户画像与旅程列表" subtitle="行为概览、标签维护和最近旅程列表会在首屏身份信息之后继续返回。" sections={2} />}>
        <UserDetailSections tenantSlug={tenant.slug} userId={user.id} />
      </Suspense>
    </div>
  );
}
