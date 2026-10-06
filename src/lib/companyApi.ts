import type { CompanyView } from "@/lib/useCompany";

/** Loads the signed-in owner's company, or null if they have none. */
export async function fetchMyCompany(token: string): Promise<CompanyView | null> {
  const res = await fetch("/api/company/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Couldn't check your company. Try again.");
  return data.company ?? null;
}

/** Where a company owner goes after signing in. */
export function routeForCompany(company: CompanyView): string {
  return company.status === "approved" ? "/dashboard" : "/pending";
}