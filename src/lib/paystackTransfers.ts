const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY environment variable");
  return key;
}

type Json = { status?: boolean; message?: string; data?: unknown } | null;
type Raw = { network: true } | { network: false; httpStatus: number; json: Json };

async function raw(path: string, init?: RequestInit): Promise<Raw> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    });
    const json = (await res.json().catch(() => null)) as Json;
    return { network: false, httpStatus: res.status, json };
  } catch {
    return { network: true };
  }
}

async function strict<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await raw(path, init);
  if (r.network) throw new Error("Couldn't reach the payment provider. Try again.");
  if (r.httpStatus < 200 || r.httpStatus >= 300 || !r.json?.status) {
    throw new Error(r.json?.message || `Payment provider request failed (${r.httpStatus})`);
  }
  return r.json.data as T;
}

export async function listBanks(): Promise<{ name: string; code: string }[]> {
  const data = await strict<{ name: string; code: string; active: boolean }[]>("/bank?currency=NGN");
  return data
    .filter((b) => b.active)
    .map((b) => ({ name: b.name, code: b.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Confirms an account number/bank pair and returns the real account name. */
export function resolveBankAccount(input: { accountNumber: string; bankCode: string }) {
  return strict<{ account_name: string; account_number: string }>(
    `/bank/resolve?account_number=${encodeURIComponent(input.accountNumber)}&bank_code=${encodeURIComponent(input.bankCode)}`
  );
}

export function createTransferRecipient(input: { name: string; accountNumber: string; bankCode: string }) {
  return strict<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
}

export type TransferResult =
  | { kind: "ok"; status: string; transferCode?: string }
  | { kind: "rejected"; message: string } // Paystack clearly refused: nothing was sent
  | { kind: "unknown" }; // timeout or server error: it may or may not have gone through

export async function initiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<TransferResult> {
  const r = await raw("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason ?? "Crafteey company payout",
    }),
  });
  if (r.network) return { kind: "unknown" };
  if (r.httpStatus >= 200 && r.httpStatus < 300 && r.json?.status) {
    const d = (r.json.data ?? {}) as { status?: string; transfer_code?: string };
    return { kind: "ok", status: d.status ?? "pending", transferCode: d.transfer_code };
  }
  if (r.httpStatus >= 400 && r.httpStatus < 500) {
    return { kind: "rejected", message: r.json?.message ?? "Transfer rejected" };
  }
  return { kind: "unknown" };
}

export type VerifyTransferResult =
  | { kind: "found"; status: string; reason?: string }
  | { kind: "not_found" }
  | { kind: "error" };

export async function verifyTransfer(reference: string): Promise<VerifyTransferResult> {
  const r = await raw(`/transfer/verify/${encodeURIComponent(reference)}`);
  if (r.network) return { kind: "error" };
  if (r.httpStatus === 404) return { kind: "not_found" };
  if (r.httpStatus >= 200 && r.httpStatus < 300 && r.json?.status) {
    const d = (r.json.data ?? {}) as { status?: string; reason?: string };
    return { kind: "found", status: String(d.status ?? ""), reason: d.reason };
  }
  return { kind: "error" };
}