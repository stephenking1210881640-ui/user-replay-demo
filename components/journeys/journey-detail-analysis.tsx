import { EmptyStatePanel } from "@/components/shared/empty-state-panel";
import { JourneyPlayback } from "@/components/journeys/journey-playback";
import { getJourneyDetail, journeyStatusLabelMap } from "@/lib/data";
import { getTenantJourneyDetail } from "@/lib/tenant-data";

export async function JourneyDetailAnalysis({
  tenantSlug,
  journeyId,
}: {
  tenantSlug?: string;
  journeyId: string;
}) {
  const detail = tenantSlug ? await getTenantJourneyDetail(tenantSlug, journeyId) : await getJourneyDetail(journeyId);

  if (!detail) {
    return (
      <EmptyStatePanel
        title="这条旅程暂时不可用"
        description="旅程基础信息存在，但完整分析数据已被移除或尚未生成。请返回列表重新选择旅程。"
        actionHref={tenantSlug ? `/tenants/${tenantSlug}/journeys` : "/journeys"}
        actionLabel="返回旅程列表"
      />
    );
  }

  const { journey, projects, availableJourneyTags } = detail;

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
    <div id="journey-analysis">
      <JourneyPlayback
        tenantSlug={tenantSlug}
        journey={serializedJourney}
        events={serializedEvents}
        evidences={serializedEvidences}
        projects={projects}
        availableJourneyTags={availableJourneyTags}
      />
    </div>
  );
}
