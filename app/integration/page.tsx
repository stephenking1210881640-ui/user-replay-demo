import { Code2, PlugZap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { SectionCard } from "@/components/shared/section-card";
import { StatusPill } from "@/components/shared/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { applicationStatusLabelMap, getApplicationOverview } from "@/lib/data";
import { formatDateTimeFull, formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const codeSnippet = `<script>
  window.InsightFlow = window.InsightFlow || [];
  InsightFlow.push(["init", {
    appKey: "if_demo_checkout_web",
    recordNetwork: true,
    captureEvidence: true
  }]);
</script>`;

const steps = [
  {
    title: "安装浏览器侧采集脚本",
    description: "将右侧代码片段插入到 Web 应用的 <head> 内，确保在业务脚本之前加载。",
  },
  {
    title: "标识用户",
    description: "在用户登录成功后调用 identify，将匿名旅程归并到真实用户。",
  },
  {
    title: "验证首条旅程",
    description: "打开站点执行一次真实操作，确认最近上报时间和日志表正常刷新。",
  },
];

export default async function IntegrationPage() {
  const { application, journeyCount24h, activeUsers24h } = await getApplicationOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="应用接入"
        subtitle="为你的 Web 应用接入用户旅程采集与 AI 分析能力"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard
          label="应用空间"
          value={application.name}
          subtext={application.host}
          accent={<StatusPill label={applicationStatusLabelMap[application.status]} tone="success" />}
        />
        <KpiCard
          label="App Key"
          value={<span className="font-mono text-lg">{application.appKey}</span>}
          subtext={`创建于 ${formatDateTimeFull(application.createdAt)}`}
        />
        <KpiCard
          label="最近上报时间"
          value={formatRelativeTime(application.lastReportedAt ?? application.createdAt)}
          subtext={formatDateTimeFull(application.lastReportedAt ?? application.createdAt)}
        />
        <KpiCard
          label="最近 24 小时旅程 / 活跃用户"
          value={`${journeyCount24h} / ${activeUsers24h}`}
          subtext="用于快速判断接入是否持续产出有效数据"
          accent={<StatusPill label="AI 分析中" tone="info" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="接入指南" description="按 Demo 最小闭环完成脚本接入、用户识别与首条旅程验证。">
          <div className="space-y-5">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="标准接入代码"
          description="原型 HTML 只作为参考，这里已重写为 React 页面与真实代码块展示。"
          action={<Code2 className="h-4 w-4 text-slate-400" />}
        >
          <div className="overflow-hidden rounded-2xl bg-slate-900">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-400">
              <span>HTML 代码片段</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-200">
                recordNetwork = true
              </span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 text-sm leading-7 text-slate-100">{codeSnippet}</pre>
          </div>
          <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-700">
            开启 <code className="font-mono">recordNetwork</code> 后，AI 可直接分析失败请求、报错 toast
            与支付前的代码级阻断。
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="实时数据校验日志"
        description="查看最近一批数据接收、聚合与校验结果，快速判断接入是否生效。"
        action={<PlugZap className="h-4 w-4 text-slate-400" />}
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="px-4 text-slate-500">时间</TableHead>
              <TableHead className="px-4 text-slate-500">来源</TableHead>
              <TableHead className="px-4 text-slate-500">状态</TableHead>
              <TableHead className="px-4 text-slate-500">消息</TableHead>
              <TableHead className="px-4 text-slate-500">摘要</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {application.integrationLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="px-4 font-mono text-xs text-slate-500">
                  {formatDateTimeFull(log.createdAt)}
                </TableCell>
                <TableCell className="px-4 text-sm text-slate-700">{log.source}</TableCell>
                <TableCell className="px-4">
                  <StatusPill
                    label={log.status}
                    tone={
                      log.level === "error" ? "error" : log.level === "warn" ? "warning" : "success"
                    }
                  />
                </TableCell>
                <TableCell className="max-w-[360px] px-4 whitespace-normal text-sm leading-6 text-slate-700">
                  {log.message}
                </TableCell>
                <TableCell className="px-4 text-sm text-slate-500">{log.payloadSummary}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
