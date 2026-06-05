"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function TagDeleteButton({ tagId, tagName }: { tagId: string; tagName: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`确认删除标签“${tagName}”吗？相关关联也会一并清理。`)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "删除失败。");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
      {submitting ? "删除中..." : "删除"}
    </Button>
  );
}
