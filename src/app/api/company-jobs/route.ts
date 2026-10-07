import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyJob from "@/models/CompanyJob";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";

export const dynamic = "force-dynamic";

/** GET /api/company-jobs : the owner sees every job, a staff member sees only theirs. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    await connectToDatabase();

    const filter: Record<string, unknown> = { companyId: access.companyId };
    if (!access.isOwner) filter.workerUid = decoded.uid;

    const jobs = await CompanyJob.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({
      isOwner: access.isOwner,
      jobs: jobs.map((j) => ({
        id: String(j._id),
        title: j.title,
        clientName: j.clientName,
        area: j.area,
        status: j.status,
        workerName: j.workerName ?? null,
        createdAt: new Date(j.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("company jobs list error", err);
    return NextResponse.json({ error: "Couldn't load your jobs." }, { status: 500 });
  }
}