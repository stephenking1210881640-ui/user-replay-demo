"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function RemoveJourneyButton({
  projectId,
  journeyId,
}: {
  projectId: string;
  journeyId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleRemove() {
    if (!window.confirm("确认将该旅程移出当前研究项目吗？")) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/journeys/${journeyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "移除失败。");
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "移除失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button variant="destructive" onClick={handleRemove} disabled={submitting}>
      {submitting ? "移除中..." : "移出项目"}
    </Button>
  );
}
