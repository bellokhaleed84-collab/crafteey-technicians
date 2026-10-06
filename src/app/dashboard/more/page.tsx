"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { TRADE_LABELS } from "@/lib/trades";
import PageHeader from "@/components/PageHeader";

const LINKS = [
  { label: "Company profile", href: "/dashboard/more/profile" },
  { label: "Staff", href: "/dashboard/more/staff" },
];
const SOON = ["Payment information", "Settings"];

function Chevron() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink-faint"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

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
    <div>
      <PageHeader title="More" subtitle={company.businessName} />

      <div className="space-y-4 px-5 pt-4">
        <section className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-card">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl border border-surface-border object-contain"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-light text-xl font-bold text-brand-dark"
            >
              {company.businessName.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-ink">{company.businessName}</p>
            {company.verified && (
              <p className="mt-0.5 text-xs font-semibold text-status-success">Verified company</p>
            )}
            {trades && <p className="mt-1 text-sm text-ink-muted">{trades}</p>}
          </div>
        </section>

        <section className="divide-y divide-surface-border rounded-2xl bg-surface shadow-card">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-14 items-center justify-between px-5 text-sm font-semibold text-ink"
            >
              {item.label}
              <Chevron />
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
    </div>
  );
}