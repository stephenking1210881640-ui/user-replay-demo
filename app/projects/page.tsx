import { redirect } from "next/navigation";

import { getDefaultTenantSlug } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const tenantSlug = await getDefaultTenantSlug();
  redirect(tenantSlug ? `/tenants/${tenantSlug}/projects` : "/tenants");
}
