import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";

export default function LoadingJourneyDetailPage() {
  return (
    <DetailLoadingShell
      title="正在加载旅程详情"
      subtitle="首屏基础信息、AI 摘要和时间线入口正在准备中。"
      sections={2}
    />
  );
}
