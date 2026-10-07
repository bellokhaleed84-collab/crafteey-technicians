"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, readError } from "@/lib/apiClient";
import { nairaText } from "@/lib/quoteShared";

type Tx = {
  id: string;
  type: "credit" | "debit";
  reason: string;
  amountKobo: number;
  balanceAfterKobo: number;
  note: string | null;
  createdAt: string;
};

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(iso)
  );
}

export default function MoneyPage() {
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(getToken, "/api/company/wallet");
      if (!res.ok) throw new Error(await readError(res, "Couldn't load your wallet."));
      const d = await res.json();
      setBalance(typeof d.balanceKobo === "number" ? d.balanceKobo : 0);
      setTxs(Array.isArray(d.transactions) ? d.transactions : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your wallet.");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <header className="rounded-b-3xl bg-navy px-5 pb-16 pt-8">
        <h1 className="text-xl font-bold text-white">Money</h1>
        <p className="mt-1 text-sm text-white/70">Your company wallet</p>
      </header>

      <div className="-mt-10 space-y-4 px-5 pb-6">
        {error ? (
          <p role="alert" className="rounded-2xl bg-surface p-5 text-sm text-status-danger shadow-card">
            {error}
          </p>
        ) : (
          <section className="rounded-2xl bg-brand p-5 text-white shadow-card">
            <p className="text-sm font-semibold text-white/90">Available balance</p>
            <p className="mt-1 text-3xl font-bold">{balance === null ? "..." : nairaText(balance)}</p>
            <p className="mt-2 text-xs text-white/90">
              Earnings are added the moment a customer pays. Withdrawals are coming soon.
            </p>
          </section>
        )}

        {!error && (
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <h2 className="text-sm font-bold text-ink">Recent transactions</h2>
            {txs.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Nothing yet. Paid quotations will show here.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {t.note ?? (t.type === "credit" ? "Earnings" : "Withdrawal")}
                      </p>
                      <p className="text-xs text-ink-faint">{when(t.createdAt)}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-bold ${t.type === "credit" ? "text-status-success" : "text-ink"}`}>
                      {t.type === "credit" ? "+" : "-"}
                      {nairaText(t.amountKobo)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}