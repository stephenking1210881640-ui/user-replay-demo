import { DetailLoadingShell } from "@/components/shared/detail-loading-shell";

export default function LoadingUserDetailPage() {
  return (
    <DetailLoadingShell
      title="正在加载用户详情"
      subtitle="用户身份、标签和最近旅程摘要正在准备中。"
      sections={2}
    />
  );
}
