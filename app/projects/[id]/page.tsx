import { notFound, redirect } from "next/navigation";

import { resolveTenantSlugByProjectId } from "@/lib/tenant-data";

export default async function ProjectLegacyDetailPage({ params }: { params: { id: string } }) {
  const tenantSlug = await resolveTenantSlugByProjectId(params.id);

  if (!tenantSlug) {
    notFound();
  }

  redirect(`/tenants/${tenantSlug}/projects/${params.id}`);
}
