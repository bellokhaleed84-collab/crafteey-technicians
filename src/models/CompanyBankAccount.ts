import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ICompanyBankAccount {
  companyId: Types.ObjectId;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  recipientCode: string;
  /** Set when an existing account is replaced. Withdrawals wait until this time. */
  holdUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyBankAccountSchema = new Schema<ICompanyBankAccount>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    bankCode: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    recipientCode: { type: String, required: true },
    holdUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

const CompanyBankAccount: Model<ICompanyBankAccount> =
  (mongoose.models.CompanyBankAccount as Model<ICompanyBankAccount>) ||
  mongoose.model<ICompanyBankAccount>("CompanyBankAccount", CompanyBankAccountSchema);

export default CompanyBankAccount;