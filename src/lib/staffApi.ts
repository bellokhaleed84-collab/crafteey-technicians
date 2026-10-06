export type StaffAccess =
  | { kind: "staff"; name: string; isOnline: boolean; companyName: string }
  | { kind: "needs_verification" }
  | { kind: "inactive"; message: string }
  | { kind: "none" };

/**
 * Is this signed-in person staff at a company? The server also activates a
 * matching invite, but only when the email is verified.
 */
export async function fetchMyStaffAccess(token: string): Promise<StaffAccess> {
  const res = await fetch("/api/staff/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);

  if (res.ok) {
    if (data?.role === "staff") {
      return {
        kind: "staff",
        name: data.staff?.name ?? "",
        isOnline: !!data.staff?.isOnline,
        companyName: data.company?.name ?? "your company",
      };
    }
    return { kind: "none" };
  }

  if (res.status === 403) {
    if (data?.needsEmailVerification) return { kind: "needs_verification" };
    if (data?.companyInactive) {
      return { kind: "inactive", message: data.error || "Your company is not active right now." };
    }
    return { kind: "none" };
  }
  if (res.status === 404) return { kind: "none" };

  throw new Error("Couldn't verify your account.");
}