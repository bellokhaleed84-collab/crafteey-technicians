import type { IQuote, QuoteStatus } from "@/models/Quote";

export const QUOTE_LIMITS = {
  minKobo: 50_000, // N500
  maxKobo: 500_000_000, // N5,000,000
  maxItems: 10,
  maxTitle: 80,
  maxDescription: 600,
  maxLabel: 60,
  maxReason: 300,
  minExpiryMs: 60 * 60 * 1000, // 1 hour
  maxExpiryMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export function nairaText(kobo: number): string {
  return "\u20A6" + (kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 });
}

/** Commission is rounded to whole kobo; the company gets the rest. */
export function splitKobo(totalKobo: number, percent: number) {
  const commissionKobo = Math.round((totalKobo * percent) / 100);
  return { commissionKobo, companyEarningKobo: totalKobo - commissionKobo };
}

/** A "sent" quote past its expiry counts as expired even before the database is updated. */
export function effectiveStatus(q: { status: QuoteStatus; expiresAt: Date }, now = new Date()): QuoteStatus {
  return q.status === "sent" && new Date(q.expiresAt).getTime() < now.getTime() ? "expired" : q.status;
}

export function quoteBlockMessage(status: QuoteStatus): string {
  switch (status) {
    case "paid":
      return "This quotation is already paid.";
    case "declined":
      return "This quotation was declined.";
    case "cancelled":
      return "The company cancelled this quotation.";
    case "expired":
      return "This quotation has expired. Ask the company for a new one.";
    default:
      return "This quotation can't be paid right now.";
  }
}

/** What the chat card may see. The client never gets commission figures. */
export function quoteView(q: IQuote, role: "client" | "company") {
  const base = {
    id: String(q._id),
    conversationId: q.conversationId,
    messageId: q.messageId,
    kind: q.kind,
    reason: q.reason ?? null,
    title: q.title,
    description: q.description,
    items: (q.items ?? []).map((i) => ({ label: i.label, amountKobo: i.amountKobo })),
    totalKobo: q.totalKobo,
    expiresAt: new Date(q.expiresAt).toISOString(),
    status: effectiveStatus(q),
    jobStatus: q.jobStatus ?? null,
    jobId: q.jobId ? String(q.jobId) : null,
    paidAt: q.payment?.paidAt ? new Date(q.payment.paidAt).toISOString() : null,
    createdAt: new Date(q.createdAt).toISOString(),
  };
  if (role === "client") return base;
  return {
    ...base,
    commissionPercent: q.commissionPercent,
    commissionKobo: q.commissionKobo,
    companyEarningKobo: q.companyEarningKobo,
  };
}