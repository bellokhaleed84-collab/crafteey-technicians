import mongoose, { type Types } from "mongoose";
import CompanyWallet from "@/models/CompanyWallet";
import CompanyWalletTransaction, { type CompanyWalletReason } from "@/models/CompanyWalletTransaction";

export type CreditOnceInput = {
  companyId: Types.ObjectId | string;
  amountKobo: number;
  reason: CompanyWalletReason;
  // Unique per money move. The ledger rejects a repeat, so this can never pay twice.
  reference: string;
  note?: string;
};

function isDuplicateKey(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}

/** Adds money to a company wallet and writes the ledger row, in one transaction. Safe to call again. */
export async function creditCompanyWalletOnce(input: CreditOnceInput): Promise<{ applied: boolean }> {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Company wallet amount must be a positive whole number of kobo");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await mongoose.startSession();
    const out: { applied?: boolean } = {};
    try {
      await session.withTransaction(async () => {
        const existing = await CompanyWalletTransaction.findOne({ reference: input.reference })
          .session(session)
          .select("_id")
          .lean();
        if (existing) {
          out.applied = false;
          return;
        }
        const wallet = await CompanyWallet.findOneAndUpdate(
          { companyId: input.companyId },
          { $inc: { balanceKobo: input.amountKobo } },
          { new: true, upsert: true, session }
        );
        if (!wallet) throw new Error("Company wallet update failed");
        await CompanyWalletTransaction.create(
          [
            {
              companyId: input.companyId,
              type: "credit",
              reason: input.reason,
              amountKobo: input.amountKobo,
              balanceAfterKobo: wallet.balanceKobo,
              reference: input.reference,
              note: input.note,
            },
          ],
          { session }
        );
        out.applied = true;
      });
      if (out.applied !== undefined) return { applied: out.applied };
    } catch (e) {
      if (!isDuplicateKey(e)) throw e;
      const existing = await CompanyWalletTransaction.findOne({ reference: input.reference }).select("_id").lean();
      if (existing) return { applied: false };
    } finally {
      await session.endSession();
    }
  }
  throw new Error("Could not update the company wallet. Please try again.");
}