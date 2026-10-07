import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyWallet from "@/models/CompanyWallet";
import CompanyWalletTransaction from "@/models/CompanyWalletTransaction";
import CompanyBankAccount from "@/models/CompanyBankAccount";
import CompanyPayout from "@/models/CompanyPayout";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { initiateTransfer } from "@/lib/paystackTransfers";
import { failCompanyPayout } from "@/lib/companyPayouts";
import { nairaText } from "@/lib/quoteShared";

export const dynamic = "force-dynamic";

const MIN_KOBO = 100_000; // N1,000

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/company/withdraw   body: { amountKobo }
 * Owner only. The wallet is debited and the payout recorded in ONE transaction
 * before any money is sent, so a double tap can never spend the same naira twice.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return bad("Only the owner can withdraw.", 403);

    const body = await req.json().catch(() => null);
    const amountKobo = Number(body?.amountKobo);
    if (!Number.isInteger(amountKobo) || amountKobo < MIN_KOBO) {
      return bad(`The minimum withdrawal is ${nairaText(MIN_KOBO)}.`);
    }

    await connectToDatabase();

    const bank = await CompanyBankAccount.findOne({ companyId: access.companyId });
    if (!bank) return bad("Add your bank account first.");
    if (bank.holdUntil && bank.holdUntil.getTime() > Date.now()) {
      return bad("You changed your bank account recently. Withdrawals open again within 24 hours of the change.", 403);
    }

    const busy = await CompanyPayout.exists({ companyId: access.companyId, status: { $in: ["pending", "processing"] } });
    if (busy) return bad("You already have a withdrawal in progress. Wait for it to finish.", 409);

    const payoutId = new mongoose.Types.ObjectId();
    const reference = `cpay-${payoutId}`;
    const last4 = bank.accountNumber.slice(-4);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await CompanyWallet.findOneAndUpdate(
          { companyId: access.companyId, balanceKobo: { $gte: amountKobo } },
          { $inc: { balanceKobo: -amountKobo } },
          { new: true, session }
        );
        if (!wallet) throw Object.assign(new Error("insufficient"), { insufficient: true });

        await CompanyWalletTransaction.create(
          [
            {
              companyId: access.companyId,
              type: "debit",
              reason: "withdrawal",
              amountKobo,
              balanceAfterKobo: wallet.balanceKobo,
              reference: `withdraw_${payoutId}`,
              note: `Withdrawal to ${bank.bankName} ....${last4}`,
            },
          ],
          { session }
        );
        await CompanyPayout.create(
          [
            {
              _id: payoutId,
              companyId: access.companyId,
              amountKobo,
              status: "pending",
              reference,
              requestedByUid: decoded.uid,
              bankName: bank.bankName,
              accountName: bank.accountName,
              accountLast4: last4,
            },
          ],
          { session }
        );
      });
    } catch (e) {
      if ((e as { insufficient?: boolean } | null)?.insufficient) return bad("Your balance is too low for that amount.", 402);
      throw e;
    } finally {
      await session.endSession();
    }

    // The money is now reserved. Send it.
    const result = await initiateTransfer({ amountKobo, recipientCode: bank.recipientCode, reference });

    if (result.kind === "rejected") {
      console.error("[payout] transfer rejected", reference, result.message);
      await failCompanyPayout(String(payoutId), result.message);
      return bad("Withdrawals aren't available right now. Your money is back in your wallet. Try again later.", 502);
    }

    if (result.kind === "ok") {
      if (result.status === "success") {
        await CompanyPayout.updateOne(
          { _id: payoutId, status: { $in: ["pending", "processing"] } },
          { $set: { status: "paid", paidAt: new Date(), transferCode: result.transferCode } }
        );
        return NextResponse.json({ ok: true, status: "paid" });
      }
      await CompanyPayout.updateOne(
        { _id: payoutId, status: "pending" },
        { $set: { status: "processing", transferCode: result.transferCode } }
      );
      return NextResponse.json({ ok: true, status: "processing" });
    }

    // Unknown outcome: leave it as pending. The Money page and the webhook settle it.
    return NextResponse.json({ ok: true, status: "processing" });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("withdraw error", err);
    return bad("Couldn't start the withdrawal. Check your wallet before trying again.", 500);
  }
}