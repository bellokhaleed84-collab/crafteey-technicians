import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/company/summary
 * The numbers on the home screen. Jobs, quotes and money don't exist yet, so
 * these are zeros for now. The next steps (chat, quotes, wallet) fill them in.
 */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const company = await Company.findOne({ uid: decoded.uid, status: "approved" })
      .select("_id")
      .lean();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({
      todayEarningsKobo: 0,
      jobsToday: 0,
      newRequests: 0,
      pendingQuotes: 0,
      activeJob: null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("company summary error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}