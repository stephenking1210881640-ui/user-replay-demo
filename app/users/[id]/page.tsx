import { notFound, redirect } from "next/navigation";

import { resolveTenantSlugByUserId } from "@/lib/tenant-data";

export default async function UserLegacyDetailPage({ params }: { params: { id: string } }) {
  const tenantSlug = await resolveTenantSlugByUserId(params.id);

  if (!tenantSlug) {
    notFound();
  }

  redirect(`/tenants/${tenantSlug}/users/${params.id}`);
}
