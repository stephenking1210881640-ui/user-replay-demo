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

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [plan, setPlan] = useState("STARTER");
  const [status, setStatus] = useState("TRIAL");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetState() {
    setName("");
    setSlug("");
    setIndustry("");
    setPlan("STARTER");
    setStatus("TRIAL");
    setDescription("");
    setMessage("");
  }

  async function handleSubmit() {
    if (!name.trim() || !slug.trim() || !industry.trim()) {
      setMessage("请至少填写企业名称、slug 和行业。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          industry,
          plan,
          status,
          description,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "创建租户失败。");
        return;
      }

      router.refresh();
      router.push(`/tenants/${payload.tenant.slug}/overview`);
      setOpen(false);
      resetState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建租户失败。");
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
        创建租户
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>创建企业租户</DialogTitle>
            <DialogDescription>快速创建一个新的租户空间，并初始化一个默认应用空间。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 px-5 pb-2">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="企业名称" className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
            <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug，例如 nova-labs" className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
            <input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="行业，例如 B2B 软件" className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <select value={plan} onChange={(event) => setPlan(event.target.value)} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none">
                <option value="TRIAL">试用中</option>
                <option value="ACTIVE">正常运行</option>
                <option value="RISK">重点关注</option>
              </select>
            </div>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="租户简介" rows={3} className="rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm outline-none" />
            {message ? <div className="text-sm text-slate-500">{message}</div> : null}
          </div>

          <DialogFooter className="rounded-b-2xl border-t border-[var(--border-light)] bg-slate-50 px-5 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
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
