"use client";

import { useMemo, useState } from "react";
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

type AssignTagDialogProps = {
  entityId: string;
  entityType: "users" | "journeys";
  title: string;
  description: string;
  triggerLabel?: string;
  tags: Array<{
    id: string;
    name: string;
    color: string;
    description: string | null;
  }>;
};

export function AssignTagDialog({
  entityId,
  entityType,
  title,
  description,
  triggerLabel = "添加标签",
  tags,
}: AssignTagDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState(tags[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTag = useMemo(
    () => tags.find((tag) => tag.id === selectedTagId) ?? null,
    [selectedTagId, tags],
  );

  async function handleSubmit() {
    if (!selectedTagId) {
      setMessage("请选择一个标签。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/${entityType}/${entityId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagId: selectedTagId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "标签添加失败。");
        return;
      }

      router.refresh();
      setMessage("标签已添加。");
      setTimeout(() => setOpen(false), 300);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "标签添加失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setSelectedTagId(tags[0]?.id ?? "");
          setMessage("");
          setOpen(true);
        }}
        disabled={tags.length === 0}
      >
        <Plus className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-2">
            {tags.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前没有可添加的标签。
              </div>
            ) : (
              <>
                <select
                  value={selectedTagId}
                  onChange={(event) => setSelectedTagId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border-light)] px-3 text-sm outline-none"
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>

                {selectedTag ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <div className="font-medium text-slate-900">{selectedTag.name}</div>
                    <div className="mt-1">{selectedTag.description ?? "暂无标签说明。"}</div>
                  </div>
                ) : null}
              </>
            )}

            {message ? <div className="text-sm text-slate-500">{message}</div> : null}
          </div>

          <DialogFooter className="rounded-b-2xl border-t border-[var(--border-light)] bg-slate-50 px-5 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedTagId || tags.length === 0 || submitting}
            >
              {submitting ? "提交中..." : "确认添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
