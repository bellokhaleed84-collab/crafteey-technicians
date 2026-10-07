"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readError } from "@/lib/apiClient";
import { JOB_LABEL, type JobStatusKey } from "@/lib/jobShared";

type Row = {
  id: string;
  title: string;
  clientName: string;
  area: string;
  status: JobStatusKey;
  workerName: string | null;
  createdAt: string;
};

const CHIP: Record<JobStatusKey, string> = {
  confirmed: "bg-status-info-bg text-status-info",
  on_the_way: "bg-amber-100 text-amber-800",
  arrived: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-700",
};

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(iso));
}

export default function JobsPage() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(getToken, "/api/company-jobs");
      if (!res.ok) throw new Error(await readError(res, "Couldn't load your jobs."));
      const data = await res.json();
      setRows(Array.isArray(data.jobs) ? data.jobs : []);
      setIsOwner(!!data.isOwner);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your jobs.");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = (rows ?? []).filter((r) =>
    tab === "active" ? r.status !== "completed" && r.status !== "cancelled" : r.status === "completed" || r.status === "cancelled"
  );

  return (
    <div>
      <header className="rounded-b-3xl bg-navy px-5 pb-6 pt-8">
        <h1 className="text-xl font-bold text-white">Jobs</h1>
        <p className="mt-1 text-sm text-white/70">{isOwner ? "All your company's jobs" : "Jobs assigned to you"}</p>
      </header>

      <div className="space-y-3 px-5 py-4">
        <div className="flex gap-2">
          {(["active", "done"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === t ? "bg-brand text-white" : "bg-surface text-ink-muted shadow-card"
              }`}
            >
              {t === "active" ? "Active" : "Finished"}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
        )}
        {!rows && !error && <p className="text-sm text-ink-muted">Loading...</p>}
        {rows && shown.length === 0 && (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted shadow-card">
            {tab === "active" ? "No active jobs. Paid quotations will show up here." : "No finished jobs yet."}
          </p>
        )}

        {shown.map((r) => (
          <Link key={r.id} href={`/dashboard/jobs/${r.id}`} className="block rounded-2xl bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{r.title}</p>
                <p className="truncate text-sm text-ink-muted">{r.clientName}</p>
                {r.area && <p className="truncate text-xs text-ink-faint">{r.area}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${CHIP[r.status]}`}>
                {JOB_LABEL[r.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              {day(r.createdAt)} &middot; {r.workerName ? `Assigned to ${r.workerName}` : "Handled by the owner"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}