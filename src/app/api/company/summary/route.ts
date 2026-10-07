import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import CompanyJob from "@/models/CompanyJob";
import CompanyWalletTransaction from "@/models/CompanyWalletTransaction";
import Quote from "@/models/Quote";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

/** Start of today in Lagos (UTC+1, no daylight saving). */
function lagosDayStart(): Date {
  const hour = 3600000;
  const day = 86400000;
  return new Date(Math.floor((Date.now() + hour) / day) * day - hour);
}

/** GET /api/company/summary : the numbers on the home screen. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const company = await Company.findOne({ uid: decoded.uid, status: "approved" }).select("_id").lean();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const start = lagosDayStart();
    const [earned, jobsToday, pendingQuotes, active] = await Promise.all([
      CompanyWalletTransaction.aggregate<{ total: number }>([
        {
          $match: {
            companyId: company._id,
            type: "credit",
            reason: "quote_earning",
            createdAt: { $gte: start },
          },
        },
        { $group: { _id: null, total: { $sum: "$amountKobo" } } },
      ]),
      CompanyJob.countDocuments({ companyId: company._id, createdAt: { $gte: start } }),
      Quote.countDocuments({ companyId: company._id, status: "sent", expiresAt: { $gt: new Date() } }),
      CompanyJob.findOne({ companyId: company._id, status: { $in: ["confirmed", "on_the_way", "arrived"] } })
        .sort({ createdAt: -1 })
        .select("title status")
        .lean(),
    ]);

    return NextResponse.json({
      todayEarningsKobo: earned[0]?.total ?? 0,
      jobsToday,
      newRequests: 0,
      pendingQuotes,
      activeJob: active ? { title: active.title, stage: active.status } : null,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("company summary error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}