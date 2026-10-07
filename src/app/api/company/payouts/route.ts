import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyPayout from "@/models/CompanyPayout";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { settleCompanyPayout } from "@/lib/companyPayouts";

export const dynamic = "force-dynamic";

/** GET /api/company/payouts : withdrawal history. Also asks Paystack about any unfinished ones. Owner only. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return NextResponse.json({ error: "Only the owner can do this." }, { status: 403 });
    await connectToDatabase();

    const open = await CompanyPayout.find({
      companyId: access.companyId,
      status: { $in: ["pending", "processing"] },
    })
      .select("reference")
      .limit(5)
      .lean();
    for (const p of open) {
      await settleCompanyPayout(p.reference).catch((e) => console.error("[payout] settle failed", e));
    }

    const rows = await CompanyPayout.find({ companyId: access.companyId }).sort({ createdAt: -1 }).limit(20).lean();
    return NextResponse.json({
      payouts: rows.map((p) => ({
        id: String(p._id),
        amountKobo: p.amountKobo,
        status: p.status,
        bankName: p.bankName,
        last4: p.accountLast4,
        createdAt: new Date(p.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("payouts list error", err);
    return NextResponse.json({ error: "Couldn't load your withdrawals." }, { status: 500 });
  }
}