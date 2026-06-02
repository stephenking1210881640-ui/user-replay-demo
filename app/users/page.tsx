import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getUsers } from "@/lib/data";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { users, availableTags } = await getUsers(searchParams);
  const activeUsers = users.filter((user) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return user.lastActiveAt.getTime() >= sevenDaysAgo;
  }).length;
  const anomalyUsers = users.filter((user) =>
    user.journeys[0]?.hasAnomaly || user.userTags.some((tag) => tag.tag.name === "异常关注")
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader title="用户管理" subtitle="按用户维度查看行为特征、标签画像与最近旅程。" />

      <form className="grid gap-3 rounded-2xl border border-[var(--border-light)] bg-white p-4 shadow-[var(--card-shadow)] md:grid-cols-5">
        <input
          name="query"
          defaultValue={typeof searchParams.query === "string" ? searchParams.query : ""}
          placeholder="用户 ID / 邮箱 / 姓名"
          className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
        />
        <select
          name="tag"
          defaultValue={typeof searchParams.tag === "string" ? searchParams.tag : "all"}
          className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
        >
          <option value="all">所有标签</option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <select
          name="activeRange"
          defaultValue={typeof searchParams.activeRange === "string" ? searchParams.activeRange : "7d"}
          className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
        >
          <option value="24h">最近 24 小时</option>
          <option value="7d">最近 7 天</option>
          <option value="30d">最近 30 天</option>
        </select>
        <select
          name="device"
          defaultValue={typeof searchParams.device === "string" ? searchParams.device : "all"}
          className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
        >
          <option value="all">全部设备</option>
          <option value="Desktop">Desktop</option>
          <option value="Mobile Web">Mobile Web</option>
        </select>
        <div className="flex gap-3">
          <select
            name="os"
            defaultValue={typeof searchParams.os === "string" ? searchParams.os : "all"}
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
          >
            <option value="all">全部系统</option>
            <option value="macOS">macOS</option>
            <option value="Windows">Windows</option>
            <option value="iOS">iOS</option>
          </select>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}
          >
            应用筛选
          </button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="总用户数" value={users.length} subtext="当前筛选结果集" />
        <KpiCard label="近 7 天活跃用户" value={activeUsers} subtext="按最近活跃时间统计" />
        <KpiCard label="异常用户数" value={anomalyUsers} subtext="最近旅程存在异常或异常关注标签" />
        <KpiCard label="重点观察群体" value="价格敏感 / 高意向" subtext="AI 识别到高频流失模式" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border-light)] bg-white shadow-[var(--card-shadow)]">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="px-4 text-slate-500">用户标识</TableHead>
              <TableHead className="px-4 text-slate-500">设备 / 系统</TableHead>
              <TableHead className="px-4 text-slate-500">最近旅程摘要 (AI)</TableHead>
              <TableHead className="px-4 text-slate-500">用户标签</TableHead>
              <TableHead className="px-4 text-slate-500">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="px-4 align-top">
                  <div className="font-semibold text-slate-900">{user.externalId}</div>
                  <div className="mt-1 text-sm text-slate-500">{user.name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    最近活跃：{formatRelativeTime(user.lastActiveAt)}
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top text-sm text-slate-600">
                  <div>{user.deviceType}</div>
                  <div className="mt-1">{user.os}</div>
                  <div className="mt-1 text-xs text-slate-400">{user.browser}</div>
                </TableCell>
                <TableCell className="max-w-[420px] px-4 align-top whitespace-normal text-sm leading-6 text-slate-600">
                  {user.journeys[0]?.aiSummaryShort ?? "暂无旅程摘要"}
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="flex max-w-[220px] flex-wrap gap-2">
                    {user.userTags.map(({ tag }) => (
                      <TagChip key={tag.id} label={tag.name} color={tag.color} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <Link
                      href={`/users/${user.id}`}
                      className={cn(buttonVariants({ variant: "outline" }), "h-8")}
                    >
                      用户详情
                    </Link>
                    {user.journeys[0] ? (
                      <Link
                        href={`/journeys/${user.journeys[0].id}`}
                        className={cn(buttonVariants({ variant: "secondary" }), "h-8")}
                      >
                        查看最近旅程
                      </Link>
                    ) : (
                      <StatusPill label="暂无旅程" tone="neutral" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

