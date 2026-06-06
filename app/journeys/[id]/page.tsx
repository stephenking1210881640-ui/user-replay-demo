import { notFound, redirect } from "next/navigation";

import { resolveTenantSlugByJourneyId } from "@/lib/tenant-data";

export default async function JourneyLegacyDetailPage({ params }: { params: { id: string } }) {
  const tenantSlug = await resolveTenantSlugByJourneyId(params.id);

  if (!tenantSlug) {
    notFound();
  }

  redirect(`/tenants/${tenantSlug}/journeys/${params.id}`);
}
