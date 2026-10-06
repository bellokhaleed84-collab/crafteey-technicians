import mongoose, { Schema, type Model, type Types } from "mongoose";

export type CompanyStaffStatus = "invited" | "active" | "removed";

export interface ICompanyStaff {
  companyId: Types.ObjectId;
  ownerUid: string;
  name: string;
  /** Lowercase. Staff get access by signing in with this verified email. */
  email?: string;
  status: CompanyStaffStatus;
  /** Firebase uid, set the first time they sign in with the verified email. */
  staffUid?: string;
  isOnline: boolean;
  joinedAt?: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyStaffSchema = new Schema<ICompanyStaff>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    ownerUid: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // One company per email and per staff login. Both are unset on removal.
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    status: { type: String, enum: ["invited", "active", "removed"], default: "invited", index: true },
    staffUid: { type: String, unique: true, sparse: true },
    isOnline: { type: Boolean, default: false },
    joinedAt: Date,
    removedAt: Date,
  },
  { timestamps: true }
);

const CompanyStaff: Model<ICompanyStaff> =
  (mongoose.models.CompanyStaff as Model<ICompanyStaff>) ||
  mongoose.model<ICompanyStaff>("CompanyStaff", CompanyStaffSchema);

export default CompanyStaff;