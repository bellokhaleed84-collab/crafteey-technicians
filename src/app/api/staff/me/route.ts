import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyStaff from "@/models/CompanyStaff";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff/me
 * Is the signed-in person staff at a company? If their email matches an invite
 * and the email is VERIFIED, the invite becomes active. Responses:
 *  200 { role: "staff", staff, company }
 *  403 { needsEmailVerification: true }   invited, but email not verified yet
 *  403 { companyInactive: true }          their company is not approved right now
 *  404                                    not staff anywhere
 */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    let staff = await CompanyStaff.findOne({ staffUid: decoded.uid, status: "active" }).lean();

    if (!staff) {
      const email = decoded.email?.toLowerCase();
      if (!email) return NextResponse.json({ error: "Not a staff member." }, { status: 404 });

      const invite = await CompanyStaff.findOne({ email, status: "invited" }).lean();
      if (!invite) return NextResponse.json({ error: "Not a staff member." }, { status: 404 });

      if (!decoded.email_verified) {
        return NextResponse.json(
          { error: "Verify your email first.", needsEmailVerification: true },
          { status: 403 }
        );
      }

      try {
        staff = await CompanyStaff.findOneAndUpdate(
          { _id: invite._id, status: "invited" },
          { $set: { staffUid: decoded.uid, status: "active", joinedAt: new Date() } },
          { new: true }
        ).lean();
      } catch (err) {
        if ((err as { code?: number } | null)?.code === 11000) {
          return NextResponse.json({ error: "This account is already linked." }, { status: 409 });
        }
        throw err;
      }
      if (!staff) return NextResponse.json({ error: "Not a staff member." }, { status: 404 });
    }

    const company = await Company.findOne({ _id: staff.companyId, status: "approved" })
      .select("businessName")
      .lean();
    if (!company) {
      return NextResponse.json(
        { error: "Your company is not active right now.", companyInactive: true },
        { status: 403 }
      );
    }

    return NextResponse.json({
      role: "staff",
      staff: { _id: staff._id, name: staff.name, email: staff.email, isOnline: staff.isOnline },
      company: { name: company.businessName },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/staff/me failed:", err);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }
}