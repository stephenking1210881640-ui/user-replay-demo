import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TagChip } from "@/components/shared/tag-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TagDeleteButton } from "@/components/tags/tag-delete-button";
import { TagFormDialog } from "@/components/tags/tag-form-dialog";
import { getTenantTagManagementData, tagSourceLabelMap, tagTypeLabelMap } from "@/lib/tenant-data";
import { formatDateTimeFull } from "@/lib/format";

export const dynamic = "force-dynamic";

function TagTable({
  tenantSlug,
  tags,
}: {
  tenantSlug: string;
  tags: Awaited<ReturnType<typeof getTenantTagManagementData>>["userTags"];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50">
          <TableHead className="px-4 text-slate-500">标签名称</TableHead>
          <TableHead className="px-4 text-slate-500">类型</TableHead>
          <TableHead className="px-4 text-slate-500">描述</TableHead>
          <TableHead className="px-4 text-slate-500">关联对象数</TableHead>
          <TableHead className="px-4 text-slate-500">创建方式</TableHead>
          <TableHead className="px-4 text-slate-500">所属应用</TableHead>
          <TableHead className="px-4 text-slate-500">创建时间</TableHead>
          <TableHead className="px-4 text-slate-500">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map((tag) => (
          <TableRow key={tag.id}>
            <TableCell className="px-4 align-top">
              <TagChip label={tag.name} color={tag.color} />
            </TableCell>
            <TableCell className="px-4 align-top text-sm text-slate-600">{tagTypeLabelMap[tag.type]}</TableCell>
            <TableCell className="max-w-[360px] px-4 align-top whitespace-normal text-sm leading-6 text-slate-600">{tag.description ?? "暂无说明"}</TableCell>
            <TableCell className="px-4 align-top text-sm text-slate-600">{tag.type === "USER" ? tag._count.userTags : tag._count.journeyTags}</TableCell>
            <TableCell className="px-4 align-top text-sm text-slate-600">{tagSourceLabelMap[tag.source]}</TableCell>
            <TableCell className="px-4 align-top text-sm text-slate-600">{tag.application.name}</TableCell>
            <TableCell className="px-4 align-top text-sm text-slate-600">{formatDateTimeFull(tag.createdAt)}</TableCell>
            <TableCell className="px-4 align-top">
              <div className="flex flex-col items-start gap-2">
                <TagFormDialog tenantSlug={tenantSlug} mode="edit" initialTag={tag} />
                <TagDeleteButton tenantSlug={tenantSlug} tagId={tag.id} tagName={tag.name} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function TenantTagsPage({ params }: { params: { tenantId: string } }) {
  const { tenant, userTags, journeyTags } = await getTenantTagManagementData(params.tenantId);

  return (
    <div className="space-y-6">
      <PageHeader title="标签管理" subtitle="统一维护用户标签与旅程标签。" actions={<TagFormDialog tenantSlug={tenant.slug} mode="create" />} />

      <SectionCard title="用户标签" description="用于描述用户画像、角色与长期行为特征。">
        <TagTable tenantSlug={tenant.slug} tags={userTags} />
      </SectionCard>

      <SectionCard title="旅程标签" description="用于标记旅程状态、异常类型和研究语义。">
        <TagTable tenantSlug={tenant.slug} tags={journeyTags} />
      </SectionCard>
    </div>
  );
}
