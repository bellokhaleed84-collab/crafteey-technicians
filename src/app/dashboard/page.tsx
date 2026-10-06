"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const naira = (kobo: number) => "₦" + (kobo / 100).toLocaleString("en-NG");

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
    <div className="space-y-4 px-5 pt-8">
      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <p className="text-sm text-ink-muted">{greeting}</p>
        <h1 className="mt-0.5 text-xl font-bold text-ink">{company.businessName}</h1>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
              online ? "bg-status-success-bg text-status-success" : "bg-surface-border text-ink-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${online ? "bg-status-success" : "bg-ink-faint"}`}
            />
            {online ? "Online" : "Offline"}
          </span>
          <button
            onClick={toggleOnline}
            disabled={toggling}
            className="min-h-12 rounded-xl border border-surface-border px-5 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {toggling ? "Please wait..." : online ? "Go offline" : "Go online"}
          </button>
        </div>
        {toggleError && (
          <p role="alert" className="mt-3 rounded-lg bg-status-danger-bg p-2 text-sm text-status-danger">
            {toggleError}
          </p>
        )}
      </section>

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
          <div className="rounded-2xl bg-surface p-5 shadow-card">
            <Skeleton className="h-4 w-16" />
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface p-5 shadow-card">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-3 h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {summary && (
        <>
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h2 className="text-sm font-bold text-ink">Today</h2>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold text-ink">{naira(summary.todayEarningsKobo)}</p>
                <p className="text-xs text-ink-muted">Earnings</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-ink">{summary.jobsToday}</p>
                <p className="text-xs text-ink-muted">Jobs</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Customer requests</h2>
              <span className="text-sm font-semibold text-ink-muted">{summary.newRequests}</span>
            </div>
            {summary.newRequests === 0 && (
              <p className="mt-2 text-sm text-ink-muted">
                No new requests yet. Stay online so customers can find you.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Pending quotes</h2>
              <span className="text-sm font-semibold text-ink-muted">{summary.pendingQuotes}</span>
            </div>
            {summary.pendingQuotes === 0 && (
              <p className="mt-2 text-sm text-ink-muted">No quotes waiting for a customer.</p>
            )}
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h2 className="text-sm font-bold text-ink">Active job</h2>
            {summary.activeJob ? (
              <p className="mt-2 text-sm text-ink">
                {summary.activeJob.title} · {summary.activeJob.stage}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">You have no job in progress.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}