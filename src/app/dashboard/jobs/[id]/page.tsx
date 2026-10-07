"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readError } from "@/lib/apiClient";
import PageHeader from "@/components/PageHeader";
import { nairaText } from "@/lib/quoteShared";
import { JOB_LABEL, JOB_STEPS, NEXT_BUTTON, NEXT_STATUS, type JobStatusKey } from "@/lib/jobShared";

type Detail = {
  isOwner: boolean;
  job: {
    id: string;
    conversationId: string;
    title: string;
    description: string;
    area: string;
    clientName: string;
    status: JobStatusKey;
    workerName: string | null;
    workerUid: string | null;
    confirmedAt: string | null;
    onTheWayAt: string | null;
    arrivedAt: string | null;
    completedAt: string | null;
  };
  staff: { id: string; name: string }[];
  money: {
    paidKobo: number;
    commissionKobo: number;
    earnedKobo: number;
    payments: { title: string; kind: string; totalKobo: number }[];
  } | null;
};

function when(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(iso)
  );
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<string>("owner");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(getToken, `/api/company-jobs/${id}`);
      if (!res.ok) throw new Error(await readError(res, "Couldn't load this job."));
      const d: Detail = await res.json();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this job.");
    }
  }, [id, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Start the picker on whoever is currently assigned.
  useEffect(() => {
    if (!data) return;
    const current = data.staff.find((s) => s.name === data.job.workerName);
    setPick(current ? current.id : "owner");
  }, [data?.job.workerName, data?.staff.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance() {
    if (!data) return;
    const next = NEXT_STATUS[data.job.status];
    if (!next) return;
    if (next === "completed" && !window.confirm("Mark this job as completed?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiFetch(getToken, `/api/company-jobs/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setActionError(await readError(res, "Couldn't update the job."));
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't update the job.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignment() {
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      const res = await apiFetch(getToken, `/api/company-jobs/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ staffId: pick === "owner" ? null : pick }),
      });
      if (!res.ok) setActionError(await readError(res, "Couldn't save the assignment."));
      else setSaved(true);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't save the assignment.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Job" backHref="/dashboard/jobs" />
        <p role="alert" className="m-5 rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
          {error}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <PageHeader title="Job" backHref="/dashboard/jobs" />
        <p className="p-5 text-sm text-ink-muted">Loading...</p>
      </div>
    );
  }

  const { job, isOwner, staff, money } = data;
  const finished = job.status === "completed" || job.status === "cancelled";
  const reached = JOB_STEPS.indexOf(job.status);
  const stamp: Record<string, string | null> = {
    confirmed: job.confirmedAt,
    on_the_way: job.onTheWayAt,
    arrived: job.arrivedAt,
    completed: job.completedAt,
  };
  const nextLabel = NEXT_BUTTON[job.status];

  return (
    <div>
      <PageHeader title={job.title} subtitle={job.clientName} backHref="/dashboard/jobs" />
      <div className="space-y-4 px-5 py-4 pb-10">
        {actionError && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {actionError}
          </p>
        )}

        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{job.description}</p>
          {job.area && <p className="mt-2 text-xs text-ink-faint">{job.area}</p>}
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Progress</p>
          {job.status === "cancelled" ? (
            <p className="mt-2 text-sm font-semibold text-ink-muted">Cancelled</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {JOB_STEPS.map((s, i) => {
                const done = i <= reached;
                return (
                  <li key={s} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                        done ? "bg-status-success" : "bg-gray-300"
                      }`}
                    >
                      {done ? "\u2713" : ""}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${done ? "text-ink" : "text-ink-faint"}`}>{JOB_LABEL[s]}</p>
                      {stamp[s] && <p className="text-xs text-ink-faint">{when(stamp[s])}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {!finished && nextLabel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void advance()}
              className="mt-4 min-h-12 w-full rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Please wait..." : nextLabel}
            </button>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Who is doing this job</p>
          {isOwner && !finished ? (
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-3 rounded-xl border border-surface-border p-3 text-sm text-ink">
                <input type="radio" name="worker" checked={pick === "owner"} onChange={() => setPick("owner")} />
                <span>
                  <span className="font-semibold">I&apos;ll do it myself</span>
                  <span className="block text-xs text-ink-muted">No staff needed</span>
                </span>
              </label>
              {staff.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-surface-border p-3 text-sm text-ink"
                >
                  <input type="radio" name="worker" checked={pick === s.id} onChange={() => setPick(s.id)} />
                  <span className="font-semibold">{s.name}</span>
                </label>
              ))}
              {staff.length === 0 && (
                <p className="text-xs text-ink-muted">You have no active staff yet. Add staff from the More tab.</p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAssignment()}
                className="min-h-12 w-full rounded-xl border border-brand font-semibold text-brand disabled:opacity-60"
              >
                Save
              </button>
              {saved && <p className="text-center text-xs text-status-success">Saved.</p>}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-ink">{job.workerName ?? "The company owner"}</p>
          )}
        </section>

        {money && (
          <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Money</p>
            {money.payments.map((p, n) => (
              <div key={n} className="flex justify-between text-sm text-ink-muted">
                <span>{p.kind === "additional" ? `Additional: ${p.title}` : p.title}</span>
                <span>{nairaText(p.totalKobo)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-surface-border pt-2 text-sm text-ink-muted">
              <span>Customer paid</span>
              <span>{nairaText(money.paidKobo)}</span>
            </div>
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Crafteey commission</span>
              <span>-{nairaText(money.commissionKobo)}</span>
            </div>
            <div className="flex justify-between font-bold text-ink">
              <span>Added to your wallet</span>
              <span>{nairaText(money.earnedKobo)}</span>
            </div>
          </section>
        )}

        <Link
          href={`/dashboard/chats/${job.conversationId}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-surface-border bg-surface font-semibold text-ink"
        >
          Open chat
        </Link>
      </div>
    </div>
  );
}