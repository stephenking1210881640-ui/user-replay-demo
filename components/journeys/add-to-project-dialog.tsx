"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProjectOption = {
  id: string;
  name: string;
  goal: string;
};

export function AddToProjectDialog({
  journeyId,
  tenantSlug,
  projects,
  currentProjectIds = [],
  triggerLabel = "加入研究项目",
  compact = false,
}: {
  journeyId: string;
  tenantSlug?: string;
  projects: ProjectOption[];
  currentProjectIds?: string[];
  triggerLabel?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const availableProjects = useMemo(
    () => projects.filter((project) => !currentProjectIds.includes(project.id)),
    [projects, currentProjectIds]
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    availableProjects[0]?.id ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");

  async function handleSubmit() {
    if (!selectedProjectId) {
      setMessage("请选择一个研究项目。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/journeys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ journeyId, tenantSlug }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "加入研究项目失败。");
        return;
      }

      setMessage("已加入研究项目。");
      router.refresh();
      setTimeout(() => setOpen(false), 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入研究项目失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant={compact ? "outline" : "secondary"}
        size={compact ? "icon-sm" : "default"}
        onClick={() => {
          setSelectedProjectId(availableProjects[0]?.id ?? "");
          setMessage("");
          setOpen(true);
        }}
        disabled={projects.length === 0}
      >
        <FolderPlus className="h-4 w-4" />
        {!compact ? triggerLabel : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-[var(--border-light)] p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>加入研究项目</DialogTitle>
            <DialogDescription>
              选择一个研究项目，将当前旅程纳入后续分析。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-5 pb-2">
            {availableProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                当前旅程已经加入所有可用研究项目。
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">目标研究项目</label>
                <select
                  value={selectedProjectId}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--border-light)] bg-white px-3 text-sm outline-none ring-0"
                >
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                {selectedProjectId ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {
                      availableProjects.find((project) => project.id === selectedProjectId)
                        ?.goal
                    }
                  </div>
                ) : null}
              </div>
            )}

            {message ? <div className="text-sm text-slate-500">{message}</div> : null}
          </div>

          <DialogFooter className="rounded-b-2xl border-t border-[var(--border-light)] bg-slate-50 px-5 py-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedProjectId || submitting || availableProjects.length === 0}
            >
              {submitting ? "提交中..." : "确认加入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
