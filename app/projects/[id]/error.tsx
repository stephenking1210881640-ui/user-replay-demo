"use client";

import { DetailErrorState } from "@/components/shared/detail-error-state";

export default function ProjectDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DetailErrorState
      title="项目详情读取失败"
      description="项目基础信息通常仍然是可恢复的，失败更可能出现在样本列表或候选样本读取阶段。可以直接重试。"
      backHref="/projects"
      backLabel="返回项目列表"
      reset={reset}
    />
  );
}
