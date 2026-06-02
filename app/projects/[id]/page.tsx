import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { TagChip } from "@/components/shared/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProjectDetail, journeyStatusLabelMap } from "@/lib/data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function splitCriteria(value?: string | null) {
  if (!value) {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  try {
    const project = await getProjectDetail(params.id);

    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb="研究项目 / 项目详情"
          title={project.name}
          subtitle={project.goal}
          actions={
            <>
              <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
                返回项目列表
              </Link>
              <button className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}>添加旅程</button>
            </>
          }
        />

        <div className="rounded-2xl border border-[var(--border-light)] bg-white px-5 py-4 shadow-[var(--card-shadow)]">
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <span>
              负责人：<b className="text-slate-900">{project.ownerName}</b>
            </span>
            <span>
              创建时间：<b className="text-slate-900">{formatDateTimeFull(project.createdAt)}</b>
            </span>
            <span>
              当前旅程数：
              <b className="text-slate-900"> {project.projectJourneys.length}</b>
            </span>
            <span>
              最近更新：<b className="text-slate-900">{formatRelativeTime(project.updatedAt)}</b>
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <SectionCard title="项目说明">
            <p className="text-sm leading-7 text-slate-600">{project.description}</p>
          </SectionCard>
          <SectionCard title="样本筛选条件">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs text-slate-400">时间范围</div>
                <div className="flex flex-wrap gap-2">
                  {splitCriteria(project.filterTimeRangeLabel).map((item) => (
                    <TagChip key={item} label={item} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-slate-400">页面范围</div>
                <div className="flex flex-wrap gap-2">
                  {splitCriteria(project.filterPageTemplates).map((item) => (
                    <TagChip key={item} label={item} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-slate-400">旅程状态</div>
                <div className="flex flex-wrap gap-2">
                  {splitCriteria(project.filterStatuses).map((item) => (
                    <TagChip key={item} label={item} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs text-slate-400">标签规则</div>
                <div className="flex flex-wrap gap-2">
                  {splitCriteria(project.filterTagRules).map((item) => (
                    <TagChip key={item} label={item} />
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="已纳入旅程列表" description="围绕当前研究目标沉淀的核心样本。">
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
                      {journey.user.externalId} · {formatDateTimeFull(journey.startedAt)}
                    </div>
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
                      {journey.journeyTags.map(({ tag }) => (
                        <TagChip key={tag.id} label={tag.name} color={tag.color} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 align-top text-sm text-slate-500">
                    {formatRelativeTime(addedAt)}
                  </TableCell>
                  <TableCell className="px-4 align-top">
                    <Link href={`/journeys/${journey.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
                      查看回放
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="阶段性研究结论">
          <div className="space-y-4">
            {project.findings.map((finding, index) => (
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
                <div className="mt-3 text-xs text-slate-400">
                  证据旅程：{finding.evidenceJourneyCount} 条
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  } catch {
    notFound();
  }
}

