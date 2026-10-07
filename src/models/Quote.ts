import mongoose, { Schema, type Model, type Types } from "mongoose";

export type QuoteStatus = "sent" | "paid" | "declined" | "cancelled" | "expired";
export type QuoteKind = "main" | "additional";

export interface IQuote {
  _id: Types.ObjectId;
  conversationId: string;
  messageId: string;
  companyId: Types.ObjectId;
  clientUid: string;
  createdByUid: string;
  kind: QuoteKind;
  reason?: string;
  title: string;
  description: string;
  items: { label: string; amountKobo: number }[];
  totalKobo: number;
  commissionPercent: number;
  commissionKobo: number;
  companyEarningKobo: number;
  expiresAt: Date;
  status: QuoteStatus;
  statusAt?: Date;
  jobStatus?: "confirmed";
  jobId?: Types.ObjectId;
  companyCreditedAt?: Date;
  payment: {
    status: "none" | "pending" | "success" | "failed";
    references: string[];
    reference?: string;
    initiatedAt?: Date;
    paidAt?: Date;
    channel?: string;
  };
  lateRefunds: { reference: string; amountKobo: number; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const QuoteSchema = new Schema<IQuote>(
  {
    conversationId: { type: String, required: true },
    messageId: { type: String, required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    clientUid: { type: String, required: true },
    createdByUid: { type: String, required: true },
    kind: { type: String, enum: ["main", "additional"], default: "main" },
    reason: { type: String, maxlength: 300 },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 600 },
    items: [
      {
        _id: false,
        label: { type: String, required: true, maxlength: 60 },
        amountKobo: { type: Number, required: true, min: 1 },
      },
    ],
    totalKobo: { type: Number, required: true, min: 1 },
    commissionPercent: { type: Number, required: true, min: 0 },
    commissionKobo: { type: Number, required: true, min: 0 },
    companyEarningKobo: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ["sent", "paid", "declined", "cancelled", "expired"], default: "sent" },
    statusAt: Date,
    jobStatus: { type: String, enum: ["confirmed"] },
    jobId: { type: Schema.Types.ObjectId, ref: "CompanyJob" },
    companyCreditedAt: Date,
    payment: {
      status: { type: String, enum: ["none", "pending", "success", "failed"], default: "none" },
      references: { type: [String], default: [] },
      reference: String,
      initiatedAt: Date,
      paidAt: Date,
      channel: String,
    },
    lateRefunds: [
      { _id: false, reference: String, amountKobo: Number, at: { type: Date, default: Date.now } },
    ],
  },
  { timestamps: true }
);

QuoteSchema.index({ conversationId: 1, createdAt: 1 });
QuoteSchema.index({ clientUid: 1, status: 1 });
QuoteSchema.index({ companyId: 1, status: 1 });
QuoteSchema.index({ "payment.references": 1 });

const Quote: Model<IQuote> =
  (mongoose.models.Quote as Model<IQuote>) || mongoose.model<IQuote>("Quote", QuoteSchema);

export default Quote;