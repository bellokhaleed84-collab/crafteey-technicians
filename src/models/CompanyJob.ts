import mongoose, { Schema, type Model, type Types } from "mongoose";
import type { JobStatusKey } from "@/lib/jobShared";

export interface ICompanyJob {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  conversationId: string;
  clientUid: string;
  clientName: string;
  mainQuoteId: Types.ObjectId;
  quoteIds: Types.ObjectId[];
  title: string;
  description: string;
  area: string;
  status: JobStatusKey;
  /** Empty means the company owner is handling the job personally. */
  workerUid: string | null;
  workerName: string | null;
  assignedAt?: Date;
  onTheWayAt?: Date;
  arrivedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyJobSchema = new Schema<ICompanyJob>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: String, required: true },
    clientUid: { type: String, required: true },
    clientName: { type: String, required: true },
    mainQuoteId: { type: Schema.Types.ObjectId, ref: "Quote", required: true, unique: true },
    quoteIds: { type: [Schema.Types.ObjectId], default: [] },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 600 },
    area: { type: String, default: "" },
    status: {
      type: String,
      enum: ["confirmed", "on_the_way", "arrived", "completed", "cancelled"],
      default: "confirmed",
    },
    workerUid: { type: String, default: null },
    workerName: { type: String, default: null },
    assignedAt: Date,
    onTheWayAt: Date,
    arrivedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

CompanyJobSchema.index({ companyId: 1, status: 1, createdAt: -1 });
CompanyJobSchema.index({ clientUid: 1, createdAt: -1 });
CompanyJobSchema.index({ conversationId: 1, createdAt: -1 });
CompanyJobSchema.index({ workerUid: 1, createdAt: -1 });
CompanyJobSchema.index({ quoteIds: 1 });

const CompanyJob: Model<ICompanyJob> =
  (mongoose.models.CompanyJob as Model<ICompanyJob>) ||
  mongoose.model<ICompanyJob>("CompanyJob", CompanyJobSchema);

export default CompanyJob;