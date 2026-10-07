import mongoose, { Schema, type Model } from "mongoose";

// Read-only copy: the admin app owns this document (key "platform").
// This app only reads the fields it needs.
export interface IPlatformSettings {
  key: string;
  companyCommissionPercent?: number;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true },
    companyCommissionPercent: Number,
  },
  { timestamps: true, autoIndex: false }
);

const PlatformSettings: Model<IPlatformSettings> =
  (mongoose.models.PlatformSettings as Model<IPlatformSettings>) ||
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;