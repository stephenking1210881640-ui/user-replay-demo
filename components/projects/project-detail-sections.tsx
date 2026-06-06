import Link from "next/link";
import { Compass, FlaskConical, Target } from "lucide-react";

import { RemoveJourneyButton } from "@/components/projects/remove-journey-button";
import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProjectDetail, journeyStatusLabelMap } from "@/lib/data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { getTenantProjectDetail } from "@/lib/tenant-data";
import { cn } from "@/lib/utils";

export async function ProjectDetailSections({
  tenantSlug,
  projectId,
}: {
  tenantSlug?: string;
  projectId: string;
}) {
  const detail = tenantSlug ? await getTenantProjectDetail(tenantSlug, projectId) : await getProjectDetail(projectId);

  if (!detail) {
    return (
      <EmptyStatePanel
        title="研究项目详情暂不可读取"
        description="该研究项目基础信息存在，但分析内容未能加载完成。请返回研究项目列表后重试。"
        actionHref={tenantSlug ? `/tenants/${tenantSlug}/projects` : "/projects"}
        actionLabel="返回研究项目列表"
      />
    );
  }

  const { project, criteria, availableJourneys } = detail;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="研究项目说明" description="明确研究目标、关注对象和当前边界。">
          <div className="space-y-4 text-sm text-slate-600">
            <p className="leading-7">{project.description || "当前研究项目尚未补充说明。"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Target className="h-4 w-4" />
                  关注对象
                </div>
                <div>{project.focusTarget || project.focusArea || "未指定关注对象"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Compass className="h-4 w-4" />
                  功能点
                </div>
                <div>{project.focusFeature || project.focusArea || "未指定功能点"}</div>
              </div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="旅程筛选条件" description="展示当前研究项目中旅程的入选口径。">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs text-slate-400">时间范围</div>
              <div className="flex flex-wrap gap-2">
                {criteria.timeRanges.length === 0 ? <TagChip label="未限定" /> : criteria.timeRanges.map((item) => <TagChip key={item} label={item} />)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-slate-400">页面范围</div>
              <div className="flex flex-wrap gap-2">
                {criteria.pageTemplates.length === 0 ? <TagChip label="未限定" /> : criteria.pageTemplates.map((item) => <TagChip key={item} label={item} />)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-slate-400">旅程状态</div>
              <div className="flex flex-wrap gap-2">
                {criteria.statuses.length === 0 ? <TagChip label="未限定" /> : criteria.statuses.map((item) => <TagChip key={item} label={item} />)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-slate-400">标签规则</div>
              <div className="flex flex-wrap gap-2">
                {criteria.tagRules.length === 0 ? <TagChip label="未限定" /> : criteria.tagRules.map((item) => <TagChip key={item} label={item} />)}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="已纳入旅程" description="围绕当前研究目标沉淀的核心旅程，可直接移除不合适旅程。">
        {project.projectJourneys.length === 0 ? (
          <EmptyStatePanel
            title="当前研究项目还没有旅程"
            description="先从旅程列表选择代表性旅程，再回到这里查看结论与归档情况。"
            actionHref={tenantSlug ? `/tenants/${tenantSlug}/journeys` : "/journeys"}
            actionLabel="去旅程列表选择"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="px-4 text-slate-500">旅程</TableHead>
                <TableHead className="px-4 text-slate-500">状态</TableHead>
                <TableHead className="px-4 text-slate-500">AI 摘要</TableHead>
                <TableHead className="px-4 text-slate-500">标签</TableHead>
                <TableHead className="px-4 text-slate-500">加入时间</TableHead>
                <TableHead className="px-4 text-slate-500">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.projectJourneys.map(({ id, addedAt, journey }) => (
                <TableRow key={id}>
                  <TableCell className="px-4 align-top">
                    <div className="font-semibold text-slate-900">{journey.journeyCode}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {journey.user.externalId} · {journey.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{formatDateTimeFull(journey.startedAt)}</div>
                  </TableCell>
                  <TableCell className="px-4 align-top">
                    <StatusPill
                      label={journeyStatusLabelMap[journey.resultStatus]}
                      tone={
                        journey.resultStatus === "FAILED"
                          ? "error"
                          : journey.resultStatus === "COMPLETED"
                            ? "success"
                            : "warning"
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-[420px] px-4 align-top whitespace-normal text-sm leading-6 text-slate-600">
                    {journey.aiSummaryShort}
                  </TableCell>
                  <TableCell className="px-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {journey.journeyTags.length === 0 ? (
                        <span className="text-sm text-slate-400">暂无标签</span>
                      ) : (
                        journey.journeyTags.map(({ tag }) => (
                          <TagChip key={tag.id} label={tag.name} color={tag.color} />
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 align-top text-sm text-slate-500">{formatRelativeTime(addedAt)}</TableCell>
                  <TableCell className="px-4 align-top">
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        href={tenantSlug ? `/tenants/${tenantSlug}/journeys/${journey.id}` : `/journeys/${journey.id}`}
                        className={cn(buttonVariants({ variant: "outline" }), "h-8")}
                      >
                        查看旅程
                      </Link>
                      <RemoveJourneyButton tenantSlug={tenantSlug} projectId={project.id} journeyId={journey.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="阶段性研究结论" description="当前研究项目已沉淀的可复用分析结论。">
          <div className="space-y-4">
            {project.findings.length === 0 ? (
              <EmptyStatePanel
                title="还没有研究结论"
                description="建议先加入 2 到 3 条代表性旅程，再沉淀阶段性研究结论。"
              />
            ) : (
              project.findings.map((finding, index) => (
                <div key={finding.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-semibold text-slate-900">
                      {String(index + 1).padStart(2, "0")}. {finding.title}
                    </div>
                    <StatusPill
                      label={finding.category}
                      tone={
                        finding.category === "TECHNICAL"
                          ? "error"
                          : finding.category === "INTERACTION"
                            ? "warning"
                            : "info"
                      }
                    />
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{finding.summary}</p>
                  <div className="mt-3 text-xs text-slate-400">证据旅程：{finding.evidenceJourneyCount} 条</div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="可补充旅程" description="当前尚未纳入研究项目，但与本应用空间相关的最近旅程。">
          <div className="space-y-3">
            {availableJourneys.length === 0 ? (
              <EmptyStatePanel title="没有更多候选旅程" description="当前应用空间的最近旅程都已经加入研究项目。" />
            ) : (
              availableJourneys.map((journey) => (
                <Link
                  key={journey.id}
                  href={tenantSlug ? `/tenants/${tenantSlug}/journeys/${journey.id}` : `/journeys/${journey.id}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {journey.journeyCode} · {journey.user.externalId}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{journey.title}</div>
                    </div>
                    <FlaskConical className="h-4 w-4 text-slate-400" />
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
