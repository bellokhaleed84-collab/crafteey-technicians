import { connectToDatabase } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";

// Used only if admin has never saved the setting.
export const DEFAULT_COMPANY_COMMISSION_PERCENT = 20;

/** Company commission % from Admin > Platform Settings. */
export async function getCompanyCommissionPercent(): Promise<number> {
  await connectToDatabase();
  const row = await PlatformSettings.findOne({ key: "platform" })
    .select("companyCommissionPercent")
    .lean<{ companyCommissionPercent?: number } | null>();
  const v = row?.companyCommissionPercent;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 50
    ? v
    : DEFAULT_COMPANY_COMMISSION_PERCENT;
}