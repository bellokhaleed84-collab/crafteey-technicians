import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import CompanyStaff from "@/models/CompanyStaff";
import { AuthError } from "@/middleware/auth";
import { requireApprovedCompany } from "@/lib/companyAuth";
import { syncCompanyParticipants } from "@/lib/chatAccess";

/**
 * DELETE /api/company/staff/[id]
 * Removes a staff member. Access stops right away, and their email is freed so
 * it can be added again (here or at another company).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { company } = await requireApprovedCompany(req);

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    const removed = await CompanyStaff.findOneAndUpdate(
      { _id: params.id, companyId: company._id, status: { $ne: "removed" } },
      {
        $set: { status: "removed", isOnline: false, removedAt: new Date() },
        $unset: { email: "", staffUid: "" },
      },
      { new: true }
    ).lean();

    if (!removed) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    // Take the removed person off the company's chats right away.
    await syncCompanyParticipants(String(company._id)).catch((e) =>
      console.error("chat sync failed", e)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("company staff remove error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}