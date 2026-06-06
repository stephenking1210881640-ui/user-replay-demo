"use client";

import { DetailErrorState } from "@/components/shared/detail-error-state";

export default function UserDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DetailErrorState
      title="用户详情读取失败"
      description="如果只是深层旅程列表读取失败，首屏概览在下一次重试后通常可以快速恢复。"
      backHref="/users"
      backLabel="返回用户列表"
      reset={reset}
    />
  );
}
