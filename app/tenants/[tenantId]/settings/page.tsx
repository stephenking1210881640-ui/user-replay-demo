import { AiModelConfigForm } from "@/components/settings/ai-model-config-form";
import { PageHeader } from "@/components/layout/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { getAiModelConfigView } from "@/lib/ai-model-config";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TenantSettingsPage({ params }: { params: { tenantId: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!tenant) {
    return (
      <SectionCard title="未找到租户" description="请返回企业租户列表重新选择。">
        <p className="text-sm text-slate-600">当前租户不存在或已被删除。</p>
      </SectionCard>
    );
  }

  const config = await getAiModelConfigView(tenant.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置中心"
        subtitle="配置当前租户的 AI 模型调用参数。保存后，Agent1 应用结构理解与 Agent2 单旅程分析都会优先使用这里的配置。"
        breadcrumb="租户工作台 / 设置中心"
      />

      <SectionCard
        title="AI 模型配置"
        description="支持 OpenAI 兼容接口。当前版本按租户维度生效，不影响其他企业租户。"
      >
        <AiModelConfigForm tenantSlug={tenant.slug} initialConfig={config} />
      </SectionCard>

      <SectionCard title="生效范围" description="这组配置会影响当前租户下所有应用和旅程分析。">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Agent1：应用结构理解</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              用户在应用详情页点击“AI 理解应用”时，会读取这里的模型平台、中转地址、模型名称和 API Key。
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Agent2：单旅程分析</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              用户在旅程详情页点击“生成 AI 总结”时，会使用同一组模型配置，并结合 Agent1 生成的业务规则。
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
