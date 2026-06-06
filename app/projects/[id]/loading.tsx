import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";

export default function LoadingProjectDetailPage() {
  return (
    <DetailLoadingShell
      title="正在加载项目详情"
      subtitle="项目概览、样本列表和研究结论正在准备中。"
      sections={3}
    />
  );
}
