import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyWallet from "@/models/CompanyWallet";
import CompanyWalletTransaction from "@/models/CompanyWalletTransaction";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";

export const dynamic = "force-dynamic";

/** GET /api/company/wallet : balance and recent history. Owner only. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) {
      return NextResponse.json({ error: "Only the owner can see the company's money." }, { status: 403 });
    }
    await connectToDatabase();

    const wallet = await CompanyWallet.findOne({ companyId: access.companyId }).select("balanceKobo").lean();
    const txs = await CompanyWalletTransaction.find({ companyId: access.companyId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      balanceKobo: wallet?.balanceKobo ?? 0,
      transactions: txs.map((t) => ({
        id: String(t._id),
        type: t.type,
        reason: t.reason,
        amountKobo: t.amountKobo,
        balanceAfterKobo: t.balanceAfterKobo,
        note: t.note ?? null,
        createdAt: new Date(t.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("company wallet error", err);
    return NextResponse.json({ error: "Couldn't load your wallet." }, { status: 500 });
  }
}