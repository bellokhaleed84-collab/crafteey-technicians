import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

/** GET /api/company/me. The signed-in owner's company, or { company: null }. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();
    const company = await Company.findOne({ uid: decoded.uid }).lean();
    return NextResponse.json({ company: company ?? null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("company me error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}