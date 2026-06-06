import Link from "next/link";

import { AssignTagDialog } from "@/components/shared/assign-tag-dialog";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { SectionCard } from "@/components/shared/section-card";
import { TagChip } from "@/components/shared/tag-chip";
import { getUserDetail } from "@/lib/data";
import { formatDateTimeFull } from "@/lib/format";
import { getTenantUserDetail } from "@/lib/tenant-data";

function topCounts(values: string[]) {
  const countMap = new Map<string, number>();
  for (const value of values) {
    countMap.set(value, (countMap.get(value) ?? 0) + 1);
  }
  return Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export async function UserDetailSections({
  tenantSlug,
  userId,
}: {
  tenantSlug?: string;
  userId: string;
}) {
  const detail = tenantSlug ? await getTenantUserDetail(tenantSlug, userId) : await getUserDetail(userId);

  if (!detail) {
    return (
      <EmptyStatePanel
        title="用户详情暂不可读取"
        description="该用户基础信息存在，但详细画像或旅程列表暂未返回。请返回用户列表后重试。"
        actionHref={tenantSlug ? `/tenants/${tenantSlug}/users` : "/users"}
        actionLabel="返回用户列表"
      />
    );
  }

  const { user, availableTags } = detail;
  const commonPages = topCounts(user.journeys.map((journey) => journey.pageTemplate));
  const commonActions = topCounts(user.journeys.map((journey) => journey.businessActionType));
  const recentAnomalies = user.journeys.filter((journey) => journey.hasAnomaly).length;

  return (
    <div className="space-y-6">
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
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {user.userTags.length === 0 ? (
                <span className="text-sm text-slate-500">当前用户还没有画像标签。</span>
              ) : (
                user.userTags.map(({ tag }) => <TagChip key={tag.id} label={tag.name} color={tag.color} />)
              )}
            </div>
            <AssignTagDialog
              entityId={user.id}
              entityType="users"
              tenantSlug={tenantSlug}
              title="为用户添加标签"
              description="统一维护用户标签，避免画像语义分散。"
              tags={availableTags}
              triggerLabel="补充标签"
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard title="行为概览">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">常见页面模板</div>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                {commonPages.length === 0 ? (
                  <div className="text-slate-500">暂无可统计页面。</div>
                ) : (
                  commonPages.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-semibold text-slate-900">{count} 次</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs text-slate-400">常见事务类型</div>
              <div className="mt-2 space-y-2 text-sm text-slate-700">
                {commonActions.length === 0 ? (
                  <div className="text-slate-500">暂无可统计事务。</div>
                ) : (
                  commonActions.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-semibold text-slate-900">{count} 次</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-rose-50 p-4">
              <div className="text-xs text-rose-400">异常摘要</div>
              <div className="mt-2 text-sm font-semibold text-rose-700">最近异常旅程数：{recentAnomalies} 条</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="最近旅程">
          <div className="space-y-3">
            {user.journeys.length === 0 ? (
              <EmptyStatePanel title="当前用户还没有旅程" description="接入页或旅程列表有数据后，这里会自动展示最近旅程 AI 摘要。" />
            ) : (
              user.journeys.map((journey) => (
                <Link
                  key={journey.id}
                  href={tenantSlug ? `/tenants/${tenantSlug}/journeys/${journey.id}` : `/journeys/${journey.id}`}
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
                      {journey.journeyTags.length === 0 ? (
                        <span className="text-xs text-slate-400">暂无标签</span>
                      ) : (
                        journey.journeyTags.map(({ tag }) => (
                          <TagChip key={tag.id} label={tag.name} color={tag.color} />
                        ))
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{journey.aiSummaryShort}</p>
                </Link>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
