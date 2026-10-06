"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/Skeleton";

type Summary = {
  todayEarningsKobo: number;
  jobsToday: number;
  newRequests: number;
  pendingQuotes: number;
  activeJob: { title: string; stage: string } | null;
};

const naira = (kobo: number) => "\u20A6" + (kobo / 100).toLocaleString("en-NG");

// Days are Lagos time, whatever the phone's own clock says.
function lagosGreeting(): string {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Lagos" }).format(
        new Date()
      )
    ) % 24;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function Tile({
  tint,
  icon,
  value,
  label,
}: {
  tint: string;
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>{icon}</div>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

export default function HomePage() {
  const { getToken } = useAuth();
  const { company, refresh } = useCompanyContext();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const greeting = useMemo(lagosGreeting, []);
  const online = !!company.isOnline;

  const loadSummary = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch("/api/company/summary", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load your summary.");
      setSummary(data);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Couldn't load your summary.");
    }
  }, [getToken]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function toggleOnline() {
    setToggling(true);
    setToggleError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const res = await fetch("/api/company/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isOnline: !online }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't change your status. Try again.");
      await refresh();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Couldn't change your status. Try again.");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <header className="rounded-b-3xl bg-navy px-5 pb-16 pt-8">
        <div className="flex items-center gap-3">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white"
            >
              {company.businessName.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-white/70">{greeting}</p>
            <h1 className="truncate text-xl font-bold text-white">{company.businessName}</h1>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                online ? "bg-status-success/20 text-green-300" : "bg-white/10 text-white/70"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${online ? "bg-green-400" : "bg-white/50"}`}
              />
              {online ? "Online" : "Offline"}
            </span>
            {company.verified && (
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
                Verified
              </span>
            )}
          </div>
          <button
            onClick={toggleOnline}
            disabled={toggling}
            className="min-h-12 rounded-xl bg-white/10 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {toggling ? "Please wait..." : online ? "Go offline" : "Go online"}
          </button>
        </div>
        {toggleError && (
          <p role="alert" className="mt-3 rounded-lg bg-status-danger-bg p-2 text-sm text-status-danger">
            {toggleError}
          </p>
        )}
      </header>

      <div className="-mt-10 space-y-4 px-5">
        {summaryError && (
          <div className="space-y-3 rounded-2xl bg-surface p-5 shadow-card">
            <p role="alert" className="text-sm text-status-danger">
              {summaryError}
            </p>
            <button
              onClick={loadSummary}
              className="min-h-12 w-full rounded-xl border border-surface-border font-semibold text-ink"
            >
              Try again
            </button>
          </div>
        )}

        {!summary && !summaryError && (
          <div aria-busy="true" className="space-y-4">
            <div className="rounded-2xl bg-brand p-5 shadow-card">
              <div className="h-4 w-16 animate-pulse rounded-lg bg-white/40" />
              <div className="mt-4 flex justify-between">
                <div className="h-10 w-32 animate-pulse rounded-lg bg-white/40" />
                <div className="h-10 w-12 animate-pulse rounded-lg bg-white/40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface p-4 shadow-card">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <Skeleton className="mt-3 h-6 w-1/2" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <>
            <section className="rounded-2xl bg-brand p-5 text-white shadow-card">
              <p className="text-sm font-semibold text-white/90">Today</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold">{naira(summary.todayEarningsKobo)}</p>
                  <p className="text-xs text-white/90">Earnings</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{summary.jobsToday}</p>
                  <p className="text-xs text-white/90">Jobs</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <Tile
                tint="bg-status-info-bg text-status-info"
                icon={
                  <Icon>
                    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                    <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
                  </Icon>
                }
                value={summary.newRequests}
                label="New requests"
              />
              <Tile
                tint="bg-brand-light text-brand-dark"
                icon={
                  <Icon>
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6M9 17h4" />
                  </Icon>
                }
                value={summary.pendingQuotes}
                label="Pending quotes"
              />
              <Tile
                tint="bg-status-success-bg text-status-success"
                icon={
                  <Icon>
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </Icon>
                }
                value={summary.activeJob ? 1 : 0}
                label="Active job"
              />
            </div>

            {summary.activeJob && (
              <section className="rounded-2xl bg-surface p-4 shadow-card">
                <p className="text-sm font-semibold text-ink">{summary.activeJob.title}</p>
                <p className="mt-0.5 text-xs capitalize text-ink-muted">
                  {summary.activeJob.stage.replace(/_/g, " ")}
                </p>
              </section>
            )}

            <section className="rounded-2xl bg-surface p-5 shadow-card">
              <h2 className="text-sm font-bold text-ink">Recent activity</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Nothing yet. New messages, payments and jobs will show here.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}