import mongoose, { Schema, type Model, type Types } from "mongoose";

export type CompanyWalletReason = "quote_earning" | "withdrawal" | "adjustment";

export interface ICompanyWalletTransaction {
  companyId: Types.ObjectId;
  type: "credit" | "debit";
  reason: CompanyWalletReason;
  amountKobo: number; // always positive; `type` says which way it moved
  balanceAfterKobo: number;
  reference: string; // unique: this is what makes every money move safe to retry
  quoteId?: Types.ObjectId;
  note?: string;
  createdAt: Date;
}

// The ledger. Rows are only ever added, never edited or deleted.
const CompanyWalletTransactionSchema = new Schema<ICompanyWalletTransaction>(
  {
    companyId: { type: Schema.Types.ObjectId, required: true, index: true, immutable: true },
    type: { type: String, enum: ["credit", "debit"], required: true, immutable: true },
    reason: { type: String, enum: ["quote_earning", "withdrawal", "adjustment"], required: true, immutable: true },
    amountKobo: { type: Number, required: true, min: 1, immutable: true },
    balanceAfterKobo: { type: Number, required: true, min: 0, immutable: true },
    reference: { type: String, required: true, unique: true, immutable: true },
    quoteId: { type: Schema.Types.ObjectId, immutable: true },
    note: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CompanyWalletTransactionSchema.index({ companyId: 1, createdAt: -1 });

const CompanyWalletTransaction: Model<ICompanyWalletTransaction> =
  (mongoose.models.CompanyWalletTransaction as Model<ICompanyWalletTransaction>) ||
  mongoose.model<ICompanyWalletTransaction>("CompanyWalletTransaction", CompanyWalletTransactionSchema);

export default CompanyWalletTransaction;