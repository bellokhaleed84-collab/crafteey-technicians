import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyJob from "@/models/CompanyJob";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { postClientNotice } from "@/lib/chatNotice";
import { NEXT_STATUS, STATUS_NOTICE } from "@/lib/jobShared";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const STAMP: Record<string, string> = {
  on_the_way: "onTheWayAt",
  arrived: "arrivedAt",
  completed: "completedAt",
};

/**
 * POST /api/company-jobs/[id]/status   body: { status }
 * Moves a job one step: confirmed > on_the_way > arrived > completed.
 * Allowed for the owner, and for the staff member the job is assigned to.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!mongoose.isValidObjectId(params.id)) return bad("Job not found", 404);

    const body = await req.json().catch(() => null);
    const wanted = String(body?.status ?? "");

    await connectToDatabase();
    const job = await CompanyJob.findOne({ _id: params.id, companyId: access.companyId });
    if (!job || (!access.isOwner && job.workerUid !== decoded.uid)) return bad("Job not found", 404);

    const next = NEXT_STATUS[job.status];
    if (!next || next !== wanted) return bad("That isn't the next step for this job.", 409);

    const updated = await CompanyJob.findOneAndUpdate(
      { _id: job._id, status: job.status },
      { $set: { status: next, [STAMP[next]]: new Date() } },
      { new: true }
    );
    if (!updated) return bad("This job just changed. Refresh and try again.", 409);

    const notice = STATUS_NOTICE[next];
    if (notice) await postClientNotice(job.conversationId, notice);

    return NextResponse.json({ ok: true, status: next });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("job status error", err);
    return bad("Couldn't update the job. Try again.", 500);
  }
}