import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import CompanyJob from "@/models/CompanyJob";
import CompanyStaff from "@/models/CompanyStaff";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { postClientNotice } from "@/lib/chatNotice";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/company-jobs/[id]/assign   body: { staffId: string | null }
 * Owner only. A staff id gives the job to that person. null means the owner
 * handles the job personally (no staff needed).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return bad("Only the owner can assign a job.", 403);
    if (!mongoose.isValidObjectId(params.id)) return bad("Job not found", 404);

    const body = await req.json().catch(() => null);
    const staffId = body && body.staffId ? String(body.staffId) : null;

    await connectToDatabase();
    const job = await CompanyJob.findOne({ _id: params.id, companyId: access.companyId });
    if (!job) return bad("Job not found", 404);
    if (job.status === "completed" || job.status === "cancelled") return bad("This job is finished.", 409);

    if (!staffId) {
      await CompanyJob.updateOne(
        { _id: job._id, status: { $nin: ["completed", "cancelled"] } },
        { $set: { workerUid: null, workerName: null, assignedAt: new Date() } }
      );
      return NextResponse.json({ ok: true, workerName: null });
    }

    if (!mongoose.isValidObjectId(staffId)) return bad("Staff member not found", 404);
    const member = await CompanyStaff.findOne({
      _id: staffId,
      companyId: access.companyId,
      status: "active",
      staffUid: { $exists: true },
    }).select("name staffUid");
    if (!member || !member.staffUid) return bad("That staff member isn't active.", 404);

    await CompanyJob.updateOne(
      { _id: job._id, status: { $nin: ["completed", "cancelled"] } },
      { $set: { workerUid: member.staffUid, workerName: member.name, assignedAt: new Date() } }
    );
    await postClientNotice(job.conversationId, `${member.name} has been assigned to your job.`);

    return NextResponse.json({ ok: true, workerName: member.name });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("job assign error", err);
    return bad("Couldn't assign the job. Try again.", 500);
  }
}