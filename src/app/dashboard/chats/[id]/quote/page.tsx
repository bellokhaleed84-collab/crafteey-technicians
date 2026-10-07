"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";
import PageHeader from "@/components/PageHeader";
import { nairaText, splitKobo } from "@/lib/quoteShared";

type Line = { label: string; amount: string };

const field =
  "mt-1 block w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

function toLocalInput(d: Date): string {
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function toKobo(v: string): number {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function SendQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const additional = search.get("additional") === "1";
  const { getToken } = useAuth();

  const [title, setTitle] = useState(additional ? "Additional work" : "");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { label: "Labour", amount: "" },
    { label: "Materials", amount: "" },
  ]);
  const [expiry, setExpiry] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setExpiry(toLocalInput(new Date(Date.now() + 48 * 3600 * 1000)));
  }, []);

  useEffect(() => {
    let alive = true;
    apiFetch(getToken, "/api/quotes/commission")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.percent === "number") setPercent(d.percent);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [getToken]);

  const usedLines = useMemo(
    () => lines.filter((l) => toKobo(l.amount) > 0).map((l) => ({ label: l.label.trim(), amountKobo: toKobo(l.amount) })),
    [lines]
  );
  const hasBreakdown = usedLines.length > 0;
  const totalKobo = hasBreakdown ? usedLines.reduce((s, l) => s + l.amountKobo, 0) : toKobo(totalInput);
  const split = percent !== null && totalKobo > 0 ? splitKobo(totalKobo, percent) : null;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (usedLines.some((l) => !l.label)) return setError("Give each priced line a name.");
    if (totalKobo <= 0) return setError("Enter the total price.");
    const exp = new Date(expiry);
    if (Number.isNaN(exp.getTime())) return setError("Pick an expiry date and time.");

    setSending(true);
    try {
      const res = await apiFetch(getToken, "/api/quotes/create", {
        method: "POST",
        body: JSON.stringify({
          conversationId: id,
          kind: additional ? "additional" : "main",
          reason: additional ? reason : undefined,
          title,
          description,
          totalKobo,
          items: hasBreakdown ? usedLines : [],
          expiresAt: exp.toISOString(),
        }),
      });
      if (res.ok) {
        router.push(`/dashboard/chats/${id}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't send the quotation. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the quotation. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={additional ? "Additional quotation" : "New quotation"}
        backHref={`/dashboard/chats/${id}`}
      />
      <form onSubmit={submit} className="space-y-4 px-5 py-4 pb-10">
        {error && (
          <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
            {error}
          </p>
        )}

        {additional && (
          <label className="block text-sm font-semibold text-ink">
            Reason
            <textarea
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The drainage pipe also needs replacement"
              className={field}
            />
          </label>
        )}

        <label className="block text-sm font-semibold text-ink">
          Title
          <input
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen sink repair"
            className={field}
          />
        </label>

        <label className="block text-sm font-semibold text-ink">
          Work description
          <textarea
            rows={3}
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Replace damaged kitchen sink pipe and reconnect drainage."
            className={field}
          />
        </label>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">Optional breakdown (&#8358;)</p>
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input
                maxLength={60}
                value={l.label}
                onChange={(e) => setLine(i, { label: e.target.value })}
                placeholder="Item"
                className="min-w-0 flex-1 rounded-xl border border-surface-border bg-surface px-3 py-3 text-ink outline-none focus:border-brand"
              />
              <input
                inputMode="decimal"
                value={l.amount}
                onChange={(e) => setLine(i, { amount: e.target.value })}
                placeholder="0"
                className="w-28 rounded-xl border border-surface-border bg-surface px-3 py-3 text-right text-ink outline-none focus:border-brand"
              />
              {i >= 2 && (
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))}
                  className="px-2 text-ink-muted"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          {lines.length < 10 && (
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, { label: "", amount: "" }])}
              className="text-sm font-semibold text-brand"
            >
              + Add item
            </button>
          )}
        </section>

        {hasBreakdown ? (
          <div className="flex justify-between rounded-xl bg-surface p-4 text-sm font-bold text-ink shadow-card">
            <span>Total price</span>
            <span>{nairaText(totalKobo)}</span>
          </div>
        ) : (
          <label className="block text-sm font-semibold text-ink">
            Total price (&#8358;)
            <input
              inputMode="decimal"
              value={totalInput}
              onChange={(e) => setTotalInput(e.target.value)}
              placeholder="35,000"
              className={field}
            />
          </label>
        )}

        <label className="block text-sm font-semibold text-ink">
          Quote expires
          <input
            type="datetime-local"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className={field}
          />
        </label>

        {split && (
          <div className="space-y-1 rounded-xl bg-surface p-4 text-sm shadow-card">
            <div className="flex justify-between text-ink-muted">
              <span>Customer will pay</span>
              <span>{nairaText(totalKobo)}</span>
            </div>
            <div className="flex justify-between text-ink-muted">
              <span>Crafteey commission ({percent}%)</span>
              <span>-{nairaText(split.commissionKobo)}</span>
            </div>
            <div className="flex justify-between font-bold text-ink">
              <span>Company receives</span>
              <span>{nairaText(split.companyEarningKobo)}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-muted">
          Once the customer has seen a quotation it can't be edited. To change the price, send a new one.
        </p>

        <button
          type="submit"
          disabled={sending}
          className="min-h-12 w-full rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send quotation"}
        </button>
      </form>
    </div>
  );
}