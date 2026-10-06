import type { NextRequest } from "next/server";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

export type OwnerCompany = { _id: Types.ObjectId; businessName: string; email: string };

/**
 * For owner-only API routes. Checks the token, then finds the owner's APPROVED
 * company. Throws AuthError (403) if there isn't one.
 */
export async function requireApprovedCompany(req: NextRequest) {
  const decoded = await verifyToken(req);
  await connectToDatabase();
  const company = await Company.findOne({ uid: decoded.uid, status: "approved" })
    .select("_id businessName email")
    .lean();
  if (!company) throw new AuthError("Only an approved company can do this.", 403);
  return { decoded, company: company as unknown as OwnerCompany };
}