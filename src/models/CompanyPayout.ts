import mongoose, { Schema, type Model, type Types } from "mongoose";

export type CompanyPayoutStatus = "pending" | "processing" | "paid" | "failed";

export interface ICompanyPayout {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  amountKobo: number;
  status: CompanyPayoutStatus;
  reference: string;
  transferCode?: string;
  failureReason?: string;
  requestedByUid: string;
  bankName: string;
  accountName: string;
  accountLast4: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyPayoutSchema = new Schema<ICompanyPayout>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    amountKobo: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["pending", "processing", "paid", "failed"], default: "pending", index: true },
    reference: { type: String, required: true, unique: true },
    transferCode: String,
    failureReason: String,
    requestedByUid: { type: String, required: true },
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountLast4: { type: String, required: true },
    paidAt: Date,
  },
  { timestamps: true }
);

CompanyPayoutSchema.index({ companyId: 1, createdAt: -1 });

const CompanyPayout: Model<ICompanyPayout> =
  (mongoose.models.CompanyPayout as Model<ICompanyPayout>) ||
  mongoose.model<ICompanyPayout>("CompanyPayout", CompanyPayoutSchema);

export default CompanyPayout;