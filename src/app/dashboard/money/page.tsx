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
type Payout = {
  id: string;
  amountKobo: number;
  status: "pending" | "processing" | "paid" | "failed";
  bankName: string;
  last4: string;
  createdAt: string;
};
type Bank = { hasBank: boolean; bankName?: string; accountName?: string; last4?: string; holdUntil?: string | null };

const MIN_KOBO = 100_000;

const PAYOUT_CHIP: Record<Payout["status"], { label: string; cls: string }> = {
  pending: { label: "Processing", cls: "bg-amber-100 text-amber-800" },
  processing: { label: "Processing", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", cls: "bg-green-100 text-green-700" },
  failed: { label: "Failed, refunded", cls: "bg-red-100 text-red-700" },
};

function when(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(
    new Date(iso)
  );
}

function toKobo(v: string): number {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const field =
  "mt-1 block w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand";

export default function MoneyPage() {
  const { getToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [editingBank, setEditingBank] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  const [amount, setAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, b, p] = await Promise.all([
        apiFetch(getToken, "/api/company/wallet"),
        apiFetch(getToken, "/api/company/bank-account"),
        apiFetch(getToken, "/api/company/payouts"),
      ]);
      if (!w.ok) throw new Error(await readError(w, "Couldn't load your wallet."));
      const wd = await w.json();
      setBalance(typeof wd.balanceKobo === "number" ? wd.balanceKobo : 0);
      setTxs(Array.isArray(wd.transactions) ? wd.transactions : []);
      if (b.ok) setBank(await b.json());
      if (p.ok) {
        const pd = await p.json();
        setPayouts(Array.isArray(pd.payouts) ? pd.payouts : []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your wallet.");
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!(editingBank || (bank && !bank.hasBank)) || banks.length > 0) return;
    apiFetch(getToken, "/api/company/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && Array.isArray(d.banks) && setBanks(d.banks))
      .catch(() => {});
  }, [editingBank, bank, banks.length, getToken]);

  async function saveBank(e: React.FormEvent) {
    e.preventDefault();
    if (savingBank) return;
    setMsg(null);
    if (!bankCode || accountNumber.length !== 10) {
      return setMsg({ ok: false, text: "Choose a bank and enter a 10-digit account number." });
    }
    setSavingBank(true);
    try {
      const res = await apiFetch(getToken, "/api/company/bank-account", {
        method: "POST",
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't save your bank account."));
      const saved: Bank = await res.json();
      setBank(saved);
      setEditingBank(false);
      setAccountNumber("");
      setMsg({
        ok: true,
        text: saved.holdUntil
          ? "Account saved. For your safety, withdrawals open again 24 hours after a change."
          : "Account saved.",
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't save your bank account." });
    } finally {
      setSavingBank(false);
    }
  }

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    if (withdrawing || !bank?.hasBank) return;
    setMsg(null);
    const kobo = toKobo(amount);
    if (kobo < MIN_KOBO) return setMsg({ ok: false, text: `The minimum withdrawal is ${nairaText(MIN_KOBO)}.` });
    if (balance !== null && kobo > balance) return setMsg({ ok: false, text: "That is more than your balance." });
    if (!window.confirm(`Send ${nairaText(kobo)} to ${bank.accountName} (${bank.bankName} ....${bank.last4})?`)) return;

    setWithdrawing(true);
    try {
      const res = await apiFetch(getToken, "/api/company/withdraw", {
        method: "POST",
        body: JSON.stringify({ amountKobo: kobo }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't start the withdrawal."));
      const d = await res.json();
      setAmount("");
      setMsg({
        ok: true,
        text: d.status === "paid" ? "Withdrawal sent." : "Withdrawal started. It usually arrives within minutes.",
      });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't start the withdrawal." });
    } finally {
      setWithdrawing(false);
      await load();
    }
  }

  const showBankForm = bank && (!bank.hasBank || editingBank);

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
          <>
            <section className="rounded-2xl bg-brand p-5 text-white shadow-card">
              <p className="text-sm font-semibold text-white/90">Available balance</p>
              <p className="mt-1 text-3xl font-bold">{balance === null ? "..." : nairaText(balance)}</p>
              <p className="mt-2 text-xs text-white/90">Earnings are added the moment a customer pays.</p>
            </section>

            {msg && (
              <p
                role="status"
                className={`rounded-xl p-3 text-sm ${
                  msg.ok ? "bg-status-success-bg text-status-success" : "bg-status-danger-bg text-status-danger"
                }`}
              >
                {msg.text}
              </p>
            )}

            <section className="space-y-3 rounded-2xl bg-surface p-5 shadow-card">
              <h2 className="text-sm font-bold text-ink">Withdraw to your bank</h2>

              {bank && bank.hasBank && !editingBank && (
                <>
                  <div>
                    <p className="font-semibold text-ink">{bank.accountName}</p>
                    <p className="text-xs text-ink-muted">
                      {bank.bankName} &middot; ....{bank.last4}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingBank(true)}
                      className="mt-1 text-xs font-semibold text-brand"
                    >
                      Change bank account
                    </button>
                  </div>

                  {bank.holdUntil && (
                    <p className="rounded-lg bg-status-warning-bg p-3 text-xs text-status-warning">
                      You changed your account recently. Withdrawals open again after {when(bank.holdUntil)}.
                    </p>
                  )}

                  <form onSubmit={withdraw} className="space-y-2">
                    <label className="block text-sm font-semibold text-ink">
                      Amount (&#8358;)
                      <div className="mt-1 flex gap-2">
                        <input
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="e.g. 20,000"
                          className="block w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-ink outline-none focus:border-brand"
                        />
                        <button
                          type="button"
                          onClick={() => balance !== null && setAmount(String(balance / 100))}
                          className="shrink-0 rounded-xl border border-surface-border px-4 text-sm font-semibold text-ink"
                        >
                          All
                        </button>
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={withdrawing || !!bank.holdUntil}
                      className="min-h-12 w-full rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
                    >
                      {withdrawing ? "Please wait..." : "Withdraw"}
                    </button>
                    <p className="text-xs text-ink-faint">Minimum {nairaText(MIN_KOBO)}. One withdrawal at a time.</p>
                  </form>
                </>
              )}

              {showBankForm && (
                <form onSubmit={saveBank} className="space-y-2">
                  <label className="block text-sm font-semibold text-ink">
                    Bank
                    <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={field}>
                      <option value="">{banks.length === 0 ? "Loading banks..." : "Select your bank"}</option>
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-ink">
                    Account number
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="10 digits"
                      className={field}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingBank}
                      className="min-h-12 flex-1 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-60"
                    >
                      {savingBank ? "Verifying..." : "Verify and save"}
                    </button>
                    {editingBank && (
                      <button
                        type="button"
                        onClick={() => setEditingBank(false)}
                        className="min-h-12 rounded-xl border border-surface-border px-4 font-semibold text-ink-muted"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-ink-faint">We check the account with the bank and use the name on file.</p>
                </form>
              )}
            </section>

            {payouts.length > 0 && (
              <section className="rounded-2xl bg-surface p-5 shadow-card">
                <h2 className="text-sm font-bold text-ink">Withdrawals</h2>
                <ul className="mt-3 divide-y divide-surface-border">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{nairaText(p.amountKobo)}</p>
                        <p className="truncate text-xs text-ink-faint">
                          {p.bankName} ....{p.last4} &middot; {when(p.createdAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${PAYOUT_CHIP[p.status].cls}`}>
                        {PAYOUT_CHIP[p.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
                      <p
                        className={`shrink-0 text-sm font-bold ${t.type === "credit" ? "text-status-success" : "text-ink"}`}
                      >
                        {t.type === "credit" ? "+" : "-"}
                        {nairaText(t.amountKobo)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}