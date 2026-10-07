"use client";

import { nairaText } from "@/lib/quoteShared";

export type CompanyQuote = {
  id: string;
  kind: "main" | "additional";
  reason: string | null;
  title: string;
  description: string;
  items: { label: string; amountKobo: number }[];
  totalKobo: number;
  expiresAt: string;
  status: "sent" | "paid" | "declined" | "cancelled" | "expired";
  commissionPercent?: number;
  commissionKobo?: number;
  companyEarningKobo?: number;
};

const CHIP: Record<CompanyQuote["status"], { label: string; cls: string }> = {
  sent: { label: "Waiting for customer", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", cls: "bg-green-100 text-green-700" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-200 text-gray-700" },
  expired: { label: "Expired", cls: "bg-gray-200 text-gray-700" },
};

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export default function QuoteCard({
  quote,
  busy,
  onCancel,
}: {
  quote: CompanyQuote;
  busy: boolean;
  onCancel: (id: string) => void;
}) {
  const chip = CHIP[quote.status];
  return (
    <div className="w-full max-w-[85%] overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
      <div className="flex items-center justify-between bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
        <span>{quote.kind === "additional" ? "Additional quotation" : "Quotation"}</span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="font-bold text-ink">{quote.title}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-muted">{quote.description}</p>
          {quote.reason && <p className="mt-1 text-xs text-ink-faint">Reason: {quote.reason}</p>}
        </div>

        {quote.items.length > 0 && (
          <div className="space-y-1 border-t border-surface-border pt-2 text-sm">
            {quote.items.map((i, n) => (
              <div key={n} className="flex justify-between text-ink-muted">
                <span>{i.label}</span>
                <span>{nairaText(i.amountKobo)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between border-t border-surface-border pt-2 font-bold text-ink">
          <span>Total</span>
          <span>{nairaText(quote.totalKobo)}</span>
        </div>

        {typeof quote.commissionKobo === "number" && typeof quote.companyEarningKobo === "number" && (
          <div className="space-y-1 rounded-lg bg-black/5 p-2 text-xs text-ink-muted">
            <div className="flex justify-between">
              <span>Crafteey commission ({quote.commissionPercent}%)</span>
              <span>-{nairaText(quote.commissionKobo)}</span>
            </div>
            <div className="flex justify-between font-semibold text-ink">
              <span>You receive</span>
              <span>{nairaText(quote.companyEarningKobo)}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-faint">
          {quote.status === "sent" ? "Expires" : "Expiry"}: {when(quote.expiresAt)}
        </p>

        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
          {quote.status === "sent" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(quote.id)}
              className="rounded-lg border border-surface-border px-3 py-1 text-xs font-semibold text-ink-muted disabled:opacity-50"
            >
              Cancel quotation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}