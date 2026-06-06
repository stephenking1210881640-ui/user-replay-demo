import { redirect } from "next/navigation";

export default function TenantEntryPage({ params }: { params: { tenantId: string } }) {
  redirect(`/tenants/${params.tenantId}/overview`);
}
