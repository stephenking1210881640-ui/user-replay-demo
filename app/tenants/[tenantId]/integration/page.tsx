import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TenantIntegrationRedirectPage({
  params,
  searchParams,
}: {
  params: { tenantId: string };
  searchParams?: { appId?: string };
}) {
  if (searchParams?.appId) {
    redirect(`/tenants/${params.tenantId}/applications/${searchParams.appId}`);
  }

  redirect(`/tenants/${params.tenantId}/applications`);
}
