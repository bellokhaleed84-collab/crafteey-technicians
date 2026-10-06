"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { TRADE_LABELS } from "@/lib/trades";

const LINKS = [
  { label: "Company profile", href: "/dashboard/more/profile" },
  { label: "Staff", href: "/dashboard/more/staff" },
];
const SOON = ["Payment information", "Settings"];

export default function MorePage() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { company } = useCompanyContext();
  const [signingOut, setSigningOut] = useState(false);

  const tradeLabels = TRADE_LABELS as Record<string, string>;
  const trades = (company.trades ?? []).map((t) => tradeLabels[t] ?? t).join(", ");

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="space-y-4 px-5 pt-8">
      <h1 className="text-2xl font-bold text-ink">More</h1>

      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <p className="text-lg font-bold text-ink">{company.businessName}</p>
        {company.verified && (
          <p className="mt-1 text-xs font-semibold text-status-success">Verified company</p>
        )}
        {trades && <p className="mt-2 text-sm text-ink-muted">{trades}</p>}
      </section>

      <section className="divide-y divide-surface-border rounded-2xl bg-surface shadow-card">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 items-center justify-between px-5 text-sm font-semibold text-ink"
          >
            {item.label}
            <span aria-hidden="true" className="text-ink-faint">
              ›
            </span>
          </Link>
        ))}
        {SOON.map((label) => (
          <div
            key={label}
            aria-disabled="true"
            className="flex min-h-14 items-center justify-between px-5 text-sm font-semibold text-ink-faint"
          >
            {label}
            <span className="rounded-full bg-surface-border px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
              Soon
            </span>
          </div>
        ))}
      </section>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="min-h-12 w-full rounded-xl border border-surface-border bg-surface py-3 font-semibold text-status-danger disabled:opacity-60"
      >
        {signingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}