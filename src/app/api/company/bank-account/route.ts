import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyBankAccount from "@/models/CompanyBankAccount";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { createTransferRecipient, listBanks, resolveBankAccount } from "@/lib/paystackTransfers";

export const dynamic = "force-dynamic";

const HOLD_MS = 24 * 60 * 60 * 1000;

function view(b: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  holdUntil?: Date | null;
} | null) {
  if (!b) return { hasBank: false };
  const hold = b.holdUntil && new Date(b.holdUntil).getTime() > Date.now() ? new Date(b.holdUntil).toISOString() : null;
  return {
    hasBank: true,
    bankName: b.bankName,
    accountName: b.accountName,
    last4: b.accountNumber.slice(-4),
    holdUntil: hold,
  };
}

/** GET /api/company/bank-account : the saved payout account (number masked). Owner only. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return NextResponse.json({ error: "Only the owner can do this." }, { status: 403 });
    await connectToDatabase();
    const b = await CompanyBankAccount.findOne({ companyId: access.companyId }).lean();
    return NextResponse.json(view(b));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("bank account read error", err);
    return NextResponse.json({ error: "Couldn't load your bank account." }, { status: 500 });
  }
}

/**
 * POST /api/company/bank-account   body: { bankCode, accountNumber }
 * Paystack confirms the account is real and gives its true name. Replacing an
 * existing account pauses withdrawals for 24 hours.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return NextResponse.json({ error: "Only the owner can do this." }, { status: 403 });

    const body = await req.json().catch(() => null);
    const bankCode = String(body?.bankCode ?? "");
    const accountNumber = String(body?.accountNumber ?? "");
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: "Choose a bank and enter a 10-digit account number." }, { status: 400 });
    }

    const banks = await listBanks();
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) return NextResponse.json({ error: "That bank isn't supported." }, { status: 400 });

    let resolved;
    let recipient;
    try {
      resolved = await resolveBankAccount({ accountNumber, bankCode });
      recipient = await createTransferRecipient({ name: resolved.account_name, accountNumber, bankCode });
    } catch (e) {
      console.error("bank verify failed", e);
      return NextResponse.json({ error: "We couldn't verify that account. Check the details and try again." }, { status: 400 });
    }

    await connectToDatabase();
    const existing = await CompanyBankAccount.findOne({ companyId: access.companyId }).lean();
    const changed = !!existing && (existing.accountNumber !== accountNumber || existing.bankCode !== bankCode);

    const saved = await CompanyBankAccount.findOneAndUpdate(
      { companyId: access.companyId },
      {
        $set: {
          bankCode,
          bankName: bank.name,
          accountNumber,
          accountName: resolved.account_name,
          recipientCode: recipient.recipient_code,
          holdUntil: changed ? new Date(Date.now() + HOLD_MS) : existing?.holdUntil ?? null,
        },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json(view(saved));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("bank account save error", err);
    return NextResponse.json({ error: "Couldn't save your bank account." }, { status: 500 });
  }
}