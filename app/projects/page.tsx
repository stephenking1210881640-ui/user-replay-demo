import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { buttonVariants } from "@/components/ui/button";
import { getProjectList } from "@/lib/data";
import { formatDateTimeFull } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function ProjectsPage() {
  const projects = await getProjectList();

  return (
    <div className="space-y-6">
      <PageHeader title="研究项目" subtitle="围绕分析任务组织样本，把临时观察沉淀为可复用的研究资产。" />

      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <SectionCard key={project.id} title={project.name} description={project.focusArea}>
            <p className="text-sm leading-7 text-slate-600">{project.goal}</p>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <div>
                负责人：<span className="font-medium text-slate-900">{project.ownerName}</span>
              </div>
              <div>{project._count.projectJourneys} 条旅程</div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-slate-400">{formatDateTimeFull(project.createdAt)}</div>
              <Link href={`/projects/${project.id}`} className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
                查看详情
              </Link>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

