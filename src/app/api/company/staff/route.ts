import { NextRequest, NextResponse } from "next/server";
import Company from "@/models/Company";
import CompanyStaff from "@/models/CompanyStaff";
import { AuthError } from "@/middleware/auth";
import { requireApprovedCompany } from "@/lib/companyAuth";

export const dynamic = "force-dynamic";

const MAX_STAFF = 50;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/company/staff. The owner's staff (removed ones are hidden). */
export async function GET(req: NextRequest) {
  try {
    const { company } = await requireApprovedCompany(req);
    const staff = await CompanyStaff.find({ companyId: company._id, status: { $ne: "removed" } })
      .select("name email status isOnline joinedAt createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ staff });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("company staff list error", err);
    return bad("Server error", 500);
  }
}

/** POST /api/company/staff  body: { name, email }. Adds a staff member by email. */
export async function POST(req: NextRequest) {
  try {
    const { decoded, company } = await requireApprovedCompany(req);

    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 60) return bad("Enter your staff member's name.");

    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 120 || !/^\S+@\S+\.\S+$/.test(email)) {
      return bad("Enter a valid email address.");
    }

    if (email === company.email) {
      return bad("That is your own sign-in email. Enter your staff member's email.");
    }

    const isOwnerAccount = await Company.exists({ email });
    if (isOwnerAccount) {
      return bad("That email can't be added. It may already be used by another company.", 409);
    }

    const count = await CompanyStaff.countDocuments({
      companyId: company._id,
      status: { $ne: "removed" },
    });
    if (count >= MAX_STAFF) return bad(`You can add up to ${MAX_STAFF} staff members.`);

    try {
      const member = await CompanyStaff.create({
        companyId: company._id,
        ownerUid: decoded.uid,
        name,
        email,
        status: "invited",
      });
      return NextResponse.json(
        {
          staff: {
            _id: member._id,
            name: member.name,
            email: member.email,
            status: member.status,
            isOnline: member.isOnline,
          },
        },
        { status: 201 }
      );
    } catch (err) {
      if ((err as { code?: number } | null)?.code === 11000) {
        return bad("That email can't be added. It may already be used by another company.", 409);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("company staff add error", err);
    return bad("Server error", 500);
  }
}