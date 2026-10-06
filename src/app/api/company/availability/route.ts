import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

/** PATCH /api/company/availability  body: { isOnline: boolean } */
export async function PATCH(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    if (typeof body?.isOnline !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Only an approved company can change this.
    const company = await Company.findOneAndUpdate(
      { uid: decoded.uid, status: "approved" },
      { $set: { isOnline: body.isOnline } },
      { new: true }
    ).lean();

    if (!company) {
      return NextResponse.json(
        { error: "Only an approved company can go online." },
        { status: 403 }
      );
    }
    return NextResponse.json({ isOnline: company.isOnline });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("company availability error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}