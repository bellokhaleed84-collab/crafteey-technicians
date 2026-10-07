import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyCommissionPercent } from "@/lib/companyCommission";

export const dynamic = "force-dynamic";

/** GET /api/quotes/commission : the current company commission %, for the quotation summary. */
export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    return NextResponse.json({ percent: await getCompanyCommissionPercent() });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("commission read error", err);
    return NextResponse.json({ error: "Couldn't load the commission." }, { status: 500 });
  }
}