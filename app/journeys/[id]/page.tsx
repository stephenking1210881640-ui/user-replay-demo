import Link from "next/link";
import { notFound } from "next/navigation";

import { JourneyPlayback } from "@/components/journeys/journey-playback";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { getJourneyDetail, journeyStatusLabelMap } from "@/lib/data";
import { formatDateTimeFull } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JourneyDetailPage({ params }: { params: { id: string } }) {
  try {
    const { journey, projects, availableJourneyTags } = await getJourneyDetail(params.id);

    const serializedJourney = {
      id: journey.id,
      journeyCode: journey.journeyCode,
      title: journey.title,
      startedAt: journey.startedAt.toISOString(),
      endedAt: journey.endedAt.toISOString(),
      totalDurationMs: journey.totalDurationMs,
      effectiveDurationMs: journey.effectiveDurationMs,
      pageUrl: journey.pageUrl,
      pageTemplate: journey.pageTemplate,
      pageTitle: journey.pageTitle,
      resultStatusLabel: journeyStatusLabelMap[journey.resultStatus],
      hasAnomaly: journey.hasAnomaly,
      businessActionType: journey.businessActionType,
      pageCount: journey.pageCount,
      keyActionCount: journey.keyActionCount,
      requestCount: journey.requestCount,
      aiSummaryShort: journey.aiSummaryShort,
      aiScenarioSummary: journey.aiScenarioSummary,
      aiProcessSummary: journey.aiProcessSummary,
      aiGoalAnalysis: journey.aiGoalAnalysis,
      aiAnomalyAnalysis: journey.aiAnomalyAnalysis,
      user: {
        id: journey.user.id,
        externalId: journey.user.externalId,
        name: journey.user.name,
        deviceType: journey.user.deviceType,
        os: journey.user.os,
        browser: journey.user.browser,
        userTags: journey.user.userTags.map(({ tag }) => ({
          tag: { id: tag.id, name: tag.name, color: tag.color },
        })),
      },
      journeyTags: journey.journeyTags.map(({ tag }) => ({
        tag: { id: tag.id, name: tag.name, color: tag.color },
      })),
      projectJourneys: journey.projectJourneys.map(({ project }) => ({
        project: { id: project.id, name: project.name },
      })),
    };

    const serializedEvents = journey.events.map((event) => ({
      id: event.id,
      seq: event.seq,
      type: event.type,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
      offsetMs: event.offsetMs,
      pageUrl: event.pageUrl,
      pageTemplate: event.pageTemplate,
      pageTitle: event.pageTitle,
      region: event.region,
      regionSource: event.regionSource,
      uiAction: event.uiAction,
      businessAction: event.businessAction,
      businessIntent: event.businessIntent,
      targetLabel: event.targetLabel,
      requestHost: event.requestHost,
      method: event.method,
      pathTemplate: event.pathTemplate,
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      requestOutcome: event.requestOutcome,
      uiFeedback: event.uiFeedback,
      isAnomaly: event.isAnomaly,
    }));

    const serializedEvidences = journey.evidences.map((evidence) => ({
      id: evidence.id,
      journeyEventId: evidence.journeyEventId,
      type: evidence.type,
      title: evidence.title,
      description: evidence.description,
      severity: evidence.severity,
      imageUrl: evidence.imageUrl,
      content: evidence.content,
      offsetMs: evidence.offsetMs,
      capturedAt: evidence.capturedAt.toISOString(),
    }));

    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumb="用户旅程 / 旅程详情"
          title={`${journey.journeyCode} · ${journey.user.externalId}`}
          subtitle={`${formatDateTimeFull(journey.startedAt)} · ${journey.title}`}
          actions={
            <>
              <Link href="/journeys" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
                返回列表
              </Link>
              <div className="flex items-center gap-2">
                <StatusPill
                  label={journeyStatusLabelMap[journey.resultStatus]}
                  tone={
                    journey.resultStatus === "FAILED"
                      ? "error"
                      : journey.resultStatus === "COMPLETED"
                        ? "success"
                        : "warning"
                  }
                />
                <StatusPill
                  label={journey.hasAnomaly ? "高危异常" : "无明显异常"}
                  tone={journey.hasAnomaly ? "error" : "neutral"}
                />
              </div>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border-light)] bg-white px-4 py-3 shadow-[var(--card-shadow)]">
          <div className="text-sm text-slate-500">用户：{journey.user.externalId}</div>
          <div className="text-sm text-slate-500">设备：{journey.user.deviceType}</div>
          <div className="text-sm text-slate-500">页面：{journey.pageTemplate}</div>
          <div className="ml-auto text-sm text-slate-500">
            关键动作 {journey.keyActionCount} · 请求 {journey.requestCount}
          </div>
        </div>

        <JourneyPlayback
          journey={serializedJourney}
          events={serializedEvents}
          evidences={serializedEvidences}
          projects={projects}
          availableJourneyTags={availableJourneyTags}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
