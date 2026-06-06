"use client";

import { DetailErrorState } from "@/components/shared/detail-error-state";

export default function JourneyDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DetailErrorState
      title="旅程详情读取失败"
      description="通常是数据库瞬时连接抖动或分析区数据读取超时。基础路由仍然可访问，建议直接重试。"
      backHref="/journeys"
      backLabel="返回旅程列表"
      reset={reset}
    />
  );
}
