"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

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

type ApplicationStatusValue = "ACTIVE" | "PENDING" | "INACTIVE";

function fieldId(name: string) {
  return `create-application-${name}`;
}

export function CreateApplicationDialog({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [appKey, setAppKey] = useState("");
  const [host, setHost] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ApplicationStatusValue>("PENDING");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetState() {
    setName("");
    setAppKey("");
    setHost("");
    setDescription("");
    setStatus("PENDING");
    setMessage("");
  }

  async function handleSubmit() {
    if (!name.trim() || !host.trim()) {
      setMessage("请填写应用名称和 host/domain。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/tenants/${tenantSlug}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          appKey,
          host,
          description,
          status,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "创建应用失败。");
        return;
      }

      router.refresh();
      router.push(`/tenants/${tenantSlug}/applications/${payload.application.id}`);
      setOpen(false);
      resetState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建应用失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          resetState();
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        创建应用
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>创建空白应用</DialogTitle>
            <DialogDescription>
              为当前租户创建一个独立应用空间，系统会自动生成 App Key 和接入 Token。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 pb-2">
            <div className="grid gap-1.5">
              <label htmlFor={fieldId("name")} className="text-sm font-medium text-slate-700">
                应用名称 <span className="text-rose-500">*</span>
              </label>
              <Input
                id={fieldId("name")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 Checkout Web"
                className="h-10"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={fieldId("app-key")} className="text-sm font-medium text-slate-700">
                应用标识 slug / appKey
              </label>
              <Input
                id={fieldId("app-key")}
                value={appKey}
                onChange={(event) => setAppKey(event.target.value)}
                placeholder="例如 checkout_web"
                className="h-10 font-mono"
              />
              <p className="text-xs leading-5 text-slate-500">
                可留空。创建后会基于该标识生成唯一 App Key，例如 checkout_web_a1b2c3。
              </p>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={fieldId("host")} className="text-sm font-medium text-slate-700">
                Host / Domain <span className="text-rose-500">*</span>
              </label>
              <Input
                id={fieldId("host")}
                value={host}
                onChange={(event) => setHost(event.target.value)}
                placeholder="例如 checkout.example.com"
                className="h-10"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={fieldId("status")} className="text-sm font-medium text-slate-700">
                初始状态
              </label>
              <select
                id={fieldId("status")}
                value={status}
                onChange={(event) => setStatus(event.target.value as ApplicationStatusValue)}
                className="h-10 rounded-lg border border-[var(--border-light)] bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="PENDING">待接入</option>
                <option value="INACTIVE">未启用</option>
                <option value="ACTIVE">已启用</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor={fieldId("description")} className="text-sm font-medium text-slate-700">
                描述
              </label>
              <textarea
                id={fieldId("description")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="说明应用覆盖的业务入口、页面范围或接入目标。"
                rows={3}
                className="rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {message ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {message}
              </div>
            ) : null}
          </div>

          <DialogFooter className="rounded-b-2xl border-t border-[var(--border-light)] bg-slate-50 px-5 py-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "创建中..." : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
