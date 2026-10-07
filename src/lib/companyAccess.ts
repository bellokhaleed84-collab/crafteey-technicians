import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import CompanyStaff from "@/models/CompanyStaff";
import { AuthError } from "@/middleware/auth";

export type CompanyAccess = {
  companyId: Types.ObjectId;
  companyName: string;
  isOwner: boolean;
};

/** Which approved company this signed-in person works for, and whether they own it. */
export async function getCompanyAccess(uid: string): Promise<CompanyAccess> {
  await connectToDatabase();

  const owned = await Company.findOne({ uid, status: "approved" }).select("_id businessName").lean();
  if (owned) {
    return { companyId: owned._id as Types.ObjectId, companyName: owned.businessName, isOwner: true };
  }

  const staff = await CompanyStaff.findOne({ staffUid: uid, status: "active" }).select("companyId").lean();
  if (staff) {
    const company = await Company.findOne({ _id: staff.companyId, status: "approved" })
      .select("businessName")
      .lean();
    if (company) {
      return { companyId: staff.companyId as Types.ObjectId, companyName: company.businessName, isOwner: false };
    }
  }

  throw new AuthError("Your company is not active right now.", 403);
}