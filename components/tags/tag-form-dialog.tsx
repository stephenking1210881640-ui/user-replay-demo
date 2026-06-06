"use client";

import { useState } from "react";
import { TagSource, TagType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TagFormDialogProps = {
  mode: "create" | "edit";
  tenantSlug?: string;
  initialTag?: {
    id: string;
    name: string;
    type: TagType;
    source: TagSource;
    color: string;
    description: string | null;
  };
};

export function TagFormDialog({ mode, tenantSlug, initialTag }: TagFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialTag?.name ?? "");
  const [type, setType] = useState<TagType>(initialTag?.type ?? TagType.USER);
  const [source, setSource] = useState<TagSource>(initialTag?.source ?? TagSource.MANUAL);
  const [color, setColor] = useState(initialTag?.color ?? "#e2e8f0");
  const [description, setDescription] = useState(initialTag?.description ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetState() {
    setName(initialTag?.name ?? "");
    setType(initialTag?.type ?? TagType.USER);
    setSource(initialTag?.source ?? TagSource.MANUAL);
    setColor(initialTag?.color ?? "#e2e8f0");
    setDescription(initialTag?.description ?? "");
    setMessage("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setMessage("请输入标签名称。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(mode === "create" ? "/api/tags" : `/api/tags/${initialTag?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          source,
          color,
          description,
          tenantSlug,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "保存失败。");
        return;
      }

      router.refresh();
      setMessage(mode === "create" ? "标签已创建。" : "标签已更新。");
      setTimeout(() => setOpen(false), 300);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant={mode === "create" ? "default" : "outline"}
        onClick={() => {
          resetState();
          setOpen(true);
        }}
      >
        {mode === "create" ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        {mode === "create" ? "新增标签" : "编辑"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{mode === "create" ? "新增标签" : "编辑标签"}</DialogTitle>
            <DialogDescription>
              统一维护用户标签与旅程标签，避免标签语义重复。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 px-5 pb-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="标签名称"
              className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
            />
            <select
              value={type}
              onChange={(event) => setType(event.target.value as TagType)}
              disabled={mode === "edit"}
              className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none disabled:bg-slate-50"
            >
              <option value={TagType.USER}>用户标签</option>
              <option value={TagType.JOURNEY}>旅程标签</option>
            </select>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as TagSource)}
              className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
            >
              <option value={TagSource.MANUAL}>人工创建</option>
              <option value={TagSource.RULE}>规则生成</option>
              <option value={TagSource.SYSTEM}>系统生成</option>
            </select>
            <input
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="#e2e8f0"
              className="h-10 rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="标签说明"
              rows={3}
              className="rounded-lg border border-[var(--border-light)] px-3 py-2 text-sm outline-none"
            />
            {message ? <div className="text-sm text-slate-500">{message}</div> : null}
          </div>

          <DialogFooter className="rounded-b-2xl border-t border-[var(--border-light)] bg-slate-50 px-5 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "保存中..." : "确认保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
