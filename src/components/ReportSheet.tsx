"use client";

import { useState } from "react";

// What a company can report about a customer.
const REASONS = [
  { value: "contact_outside", label: "Customer wants to talk or pay outside Crafteey" },
  { value: "abusive", label: "Customer is rude or abusive" },
  { value: "fake_request", label: "Fake or time-wasting request" },
  { value: "scam", label: "Looks like a scam" },
  { value: "unsafe", label: "I feel unsafe" },
  { value: "other", label: "Something else" },
];

type Props = {
  onClose: () => void;
  /** Returns an error message, or null when the report was sent. */
  onSubmit: (reason: string, details: string) => Promise<string | null>;
};

export default function ReportSheet({ onClose, onSubmit }: Props) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    const err = await onSubmit(reason, details.trim());
    setSending(false);
    if (err) setError(err);
    else setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog" aria-modal="true" aria-label="Report this customer">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5">
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-ink">Report sent</p>
            <p className="text-sm text-ink-muted">Our team will review this chat. Thank you for helping keep Crafteey safe.</p>
            <button type="button" onClick={onClose} className="min-h-12 w-full rounded-xl bg-brand px-5 font-semibold text-white">
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-bold text-ink">Report this customer</p>
              <p className="mt-1 text-sm text-ink-muted">What went wrong? Our team will read the chat.</p>
            </div>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`flex min-h-12 w-full items-center rounded-xl border px-4 py-3 text-left text-sm ${
                    reason === r.value
                      ? "border-brand bg-brand/10 font-semibold text-ink"
                      : "border-surface-border text-ink"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={reason === "other" ? "Tell us what happened" : "Add details (optional)"}
              className="w-full resize-none rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-brand"
            />
            {error && (
              <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-sm text-status-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 flex-1 rounded-xl border border-surface-border px-5 font-semibold text-ink-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!reason || sending}
                className="min-h-12 flex-1 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send report"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}