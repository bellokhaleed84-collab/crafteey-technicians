import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ICompanyWallet {
  companyId: Types.ObjectId;
  balanceKobo: number;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyWalletSchema = new Schema<ICompanyWallet>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    // Changed only through the server wallet helpers, never set directly.
    balanceKobo: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true }
);

const CompanyWallet: Model<ICompanyWallet> =
  (mongoose.models.CompanyWallet as Model<ICompanyWallet>) ||
  mongoose.model<ICompanyWallet>("CompanyWallet", CompanyWalletSchema);

export default CompanyWallet;