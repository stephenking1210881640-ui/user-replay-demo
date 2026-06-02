import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { getUserDetail } from "@/lib/data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function topCounts(values: string[]) {
  const countMap = new Map<string, number>();
  for (const value of values) {
    countMap.set(value, (countMap.get(value) ?? 0) + 1);
  }
  return Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
  try {
    const user = await getUserDetail(params.id);
    const latestJourney = user.journeys[0] ?? null;
    const commonPages = topCounts(user.journeys.map((journey) => journey.pageTemplate));
    const commonActions = topCounts(user.journeys.map((journey) => journey.businessActionType));
    const recentAnomalies = user.journeys.filter((journey) => journey.hasAnomaly).length;

    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb="用户管理 / 用户详情"
          title={`${user.externalId} · ${user.name}`}
          subtitle={`最近活跃 ${formatRelativeTime(user.lastActiveAt)} · ${user.deviceType} · ${user.os}`}
          actions={
            latestJourney ? (
              <Link
                href={`/journeys/${latestJourney.id}`}
                className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}
              >
                播放最新旅程
              </Link>
            ) : null
          }
        />

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SectionCard title="基础信息">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">用户 ID</div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-900">{user.externalId}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">邮箱</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{user.email ?? "-"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">首次出现</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatDateTimeFull(user.firstSeenAt)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">最近活跃</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatDateTimeFull(user.lastActiveAt)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">设备 / 系统</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {user.deviceType} · {user.os}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">位置</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{user.location ?? "-"}</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="标签画像">
            <div className="flex flex-wrap gap-2">
              {user.userTags.map(({ tag }) => (
                <TagChip key={tag.id} label={tag.name} color={tag.color} />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionCard title="行为概览">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">常见页面模板</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {commonPages.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-semibold text-slate-900">{count} 次</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-400">常见事务类型</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {commonActions.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-semibold text-slate-900">{count} 次</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <div className="text-xs text-rose-400">异常摘要</div>
                <div className="mt-2 text-sm font-semibold text-rose-700">最近 7 天异常次数：{recentAnomalies} 次</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="最近旅程">
            <div className="space-y-3">
              {user.journeys.map((journey) => (
                <Link
                  key={journey.id}
                  href={`/journeys/${journey.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {journey.journeyCode} · {journey.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{formatDateTimeFull(journey.startedAt)}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {journey.journeyTags.map(({ tag }) => (
                        <TagChip key={tag.id} label={tag.name} color={tag.color} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
