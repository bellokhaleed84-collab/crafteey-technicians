import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyJob from "@/models/CompanyJob";
import CompanyStaff from "@/models/CompanyStaff";
import Quote from "@/models/Quote";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";

export const dynamic = "force-dynamic";

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null);

/** GET /api/company-jobs/[id] : job detail. Money and the staff list are for the owner only. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    await connectToDatabase();

    const job = await CompanyJob.findOne({ _id: params.id, companyId: access.companyId }).lean();
    if (!job || (!access.isOwner && job.workerUid !== decoded.uid)) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let staff: { id: string; name: string }[] = [];
    let money: {
      paidKobo: number;
      commissionKobo: number;
      earnedKobo: number;
      payments: { title: string; kind: string; totalKobo: number }[];
    } | null = null;

    if (access.isOwner) {
      const members = await CompanyStaff.find({
        companyId: access.companyId,
        status: "active",
        staffUid: { $exists: true },
      })
        .select("name")
        .sort({ name: 1 })
        .lean();
      staff = members.map((m) => ({ id: String(m._id), name: m.name }));

      const quotes = await Quote.find({ _id: { $in: job.quoteIds }, status: "paid" }).sort({ createdAt: 1 }).lean();
      money = {
        paidKobo: quotes.reduce((s, q) => s + q.totalKobo, 0),
        commissionKobo: quotes.reduce((s, q) => s + q.commissionKobo, 0),
        earnedKobo: quotes.reduce((s, q) => s + q.companyEarningKobo, 0),
        payments: quotes.map((q) => ({ title: q.title, kind: q.kind, totalKobo: q.totalKobo })),
      };
    }

    return NextResponse.json({
      isOwner: access.isOwner,
      job: {
        id: String(job._id),
        conversationId: job.conversationId,
        title: job.title,
        description: job.description,
        area: job.area,
        clientName: job.clientName,
        status: job.status,
        workerName: job.workerName ?? null,
        workerUid: job.workerUid ?? null,
        confirmedAt: iso(job.createdAt),
        onTheWayAt: iso(job.onTheWayAt),
        arrivedAt: iso(job.arrivedAt),
        completedAt: iso(job.completedAt),
      },
      staff,
      money,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("company job read error", err);
    return NextResponse.json({ error: "Couldn't load this job." }, { status: 500 });
  }
}