import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyStaff from "@/models/CompanyStaff";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

/** PATCH /api/staff/availability  body: { isOnline: boolean } */
export async function PATCH(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);

    const body = await req.json().catch(() => null);
    if (typeof body?.isOnline !== "boolean") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await connectToDatabase();

    const staff = await CompanyStaff.findOne({ staffUid: decoded.uid, status: "active" })
      .select("companyId")
      .lean();
    if (!staff) {
      return NextResponse.json({ error: "Only active staff can change this." }, { status: 403 });
    }

    const companyActive = await Company.exists({ _id: staff.companyId, status: "approved" });
    if (!companyActive) {
      return NextResponse.json({ error: "Your company is not active right now." }, { status: 403 });
    }

    await CompanyStaff.updateOne({ _id: staff._id }, { $set: { isOnline: body.isOnline } });
    return NextResponse.json({ isOnline: body.isOnline });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/staff/availability failed:", err);
    return NextResponse.json({ error: "Could not change your status." }, { status: 500 });
  }
}