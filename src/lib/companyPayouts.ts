import { connectToDatabase } from "@/lib/mongodb";
import CompanyPayout, { type ICompanyPayout } from "@/models/CompanyPayout";
import { verifyTransfer } from "@/lib/paystackTransfers";
import { creditCompanyWalletOnce } from "@/lib/companyWalletOps";

/** Pays the money back to the company wallet, once. Safe to call again. */
async function refundPayout(payout: Pick<ICompanyPayout, "_id" | "companyId" | "amountKobo">) {
  await creditCompanyWalletOnce({
    companyId: payout.companyId,
    amountKobo: payout.amountKobo,
    reason: "withdrawal_refund",
    reference: `withdraw_refund_${payout._id}`,
    note: "Withdrawal failed, money returned",
  });
}

/** Marks a payout failed and returns the money. Safe to call again. */
export async function failCompanyPayout(payoutId: string, reason: string) {
  const payout = await CompanyPayout.findOneAndUpdate(
    { _id: payoutId, status: { $in: ["pending", "processing"] } },
    { $set: { status: "failed", failureReason: reason.slice(0, 200) } },
    { new: true }
  );
  const current = payout ?? (await CompanyPayout.findById(payoutId));
  if (current && current.status === "failed") await refundPayout(current);
}

/**
 * Asks Paystack what really happened to a withdrawal and updates it.
 * Called from the webhook and from the Money page, so it can run many times.
 */
export async function settleCompanyPayout(reference: string): Promise<{ status: string } | null> {
  await connectToDatabase();
  const payout = await CompanyPayout.findOne({ reference });
  if (!payout) return null;

  if (payout.status === "paid") return { status: "paid" };
  if (payout.status === "failed") {
    await refundPayout(payout); // heals a refund that didn't finish
    return { status: "failed" };
  }

  const v = await verifyTransfer(reference);

  if (v.kind === "found") {
    if (v.status === "success") {
      await CompanyPayout.updateOne(
        { _id: payout._id, status: { $in: ["pending", "processing"] } },
        { $set: { status: "paid", paidAt: new Date() } }
      );
      return { status: "paid" };
    }
    if (v.status === "failed" || v.status === "reversed") {
      await failCompanyPayout(String(payout._id), v.reason || `Transfer ${v.status}`);
      return { status: "failed" };
    }
    if (payout.status === "pending") {
      await CompanyPayout.updateOne({ _id: payout._id, status: "pending" }, { $set: { status: "processing" } });
    }
    return { status: "processing" };
  }

  // Paystack has no record of it after a couple of minutes: it was never created.
  if (v.kind === "not_found" && Date.now() - new Date(payout.createdAt).getTime() > 2 * 60 * 1000) {
    await failCompanyPayout(String(payout._id), "Transfer was never created");
    return { status: "failed" };
  }

  return { status: payout.status };
}