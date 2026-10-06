import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { AuthError } from "@/middleware/auth";
import { requireApprovedCompany } from "@/lib/companyAuth";
import { companyUids } from "@/lib/chatAccess";

export const dynamic = "force-dynamic";

/** DEV ONLY. Creates a test chat between your company and a client uid you paste in. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  try {
    const { company } = await requireApprovedCompany(req);
    const body = await req.json().catch(() => null);
    const clientUid = String(body?.clientUid ?? "").trim();
    if (!clientUid) return NextResponse.json({ error: "Enter a client uid." }, { status: 400 });

    const companyId = String(company._id);
    const uids = await companyUids(companyId);
    const ref = await adminDb.collection("conversations").add({
      clientUid,
      clientName: String(body?.clientName ?? "Test client").slice(0, 60),
      companyId,
      companyName: company.businessName,
      requestTitle: "Test request",
      participantUids: Array.from(new Set([clientUid, ...uids])),
      status: "open",
      lastMessage: "",
      lastMessageAt: FieldValue.serverTimestamp(),
      unreadCompany: 0,
      unreadClient: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("dev-seed error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}