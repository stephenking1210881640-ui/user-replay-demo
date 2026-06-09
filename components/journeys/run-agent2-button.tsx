"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RunAgent2Button({
  tenantSlug,
  journeyId,
}: {
  tenantSlug: string;
  journeyId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tenants/${tenantSlug}/journeys/${journeyId}/ai-analysis`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error ?? "Agent2 模型分析失败。");
        return;
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent2 模型分析失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleClick} disabled={submitting} size="sm">
        <BrainCircuit className="h-4 w-4" />
        {submitting ? "生成中..." : "生成 AI 总结"}
      </Button>
      {message ? <div className="max-w-64 text-right text-xs leading-5 text-rose-600">{message}</div> : null}
    </div>
  );
}
