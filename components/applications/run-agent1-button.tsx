"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function RunAgent1Button({
  tenantSlug,
  applicationId,
  defaultWebsiteUrl,
}: {
  tenantSlug: string;
  applicationId: string;
  defaultWebsiteUrl: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState(defaultWebsiteUrl);
  const [businessHint, setBusinessHint] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!websiteUrl.trim()) {
      setMessage("请填写目标应用网站地址。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tenants/${tenantSlug}/applications/${applicationId}/ai-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteUrl,
          businessHint,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Agent1 分析失败。");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent1 分析失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg">
        <BrainCircuit className="h-4 w-4" />
        AI 理解应用
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Agent1：应用结构理解与埋点策略</DialogTitle>
            <DialogDescription>
              输入目标应用地址，Agent1 会先抓取页面结构，再默认调用模型提炼结果；模型失败时自动回退规则分析。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 pb-2">
            <div className="grid gap-1.5">
              <label htmlFor="agent1-website-url" className="text-sm font-medium text-slate-700">
                目标应用网站地址
              </label>
              <Input
                id="agent1-website-url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://example.com"
                className="h-10 font-mono"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="agent1-business-hint" className="text-sm font-medium text-slate-700">
                业务提示，可选
              </label>
              <textarea
                id="agent1-business-hint"
                value={businessHint}
                onChange={(event) => setBusinessHint(event.target.value)}
                placeholder="例如：这是一个电商购物车测试应用，核心目标是从商品浏览到结算。"
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {message ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div> : null}
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              当前默认使用模型增强分析，输出会保存为应用级 AI Profile，并用于后续 region 与 SDK track 建议。
            </div>
          </div>

          <DialogFooter className="px-5">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "分析中..." : "开始分析"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
