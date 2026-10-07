import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { getConversationForUser } from "@/lib/chatAccess";
import ChatReport, { REPORT_REASONS, type ReportReason } from "@/models/ChatReport";

export const dynamic = "force-dynamic";

const DAILY_LIMIT = 5;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

/**
 * POST /api/chat/report  body: { conversationId, reason, details? }
 * Either side of a chat can report it. Admin reviews it in the admin app.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    const conversationId = String(body.conversationId ?? "");
    const reasonRaw = String(body.reason ?? "");
    const details = String(body.details ?? "").trim();

    if (!isReportReason(reasonRaw)) return bad("Choose a reason for the report.");
    const reason: ReportReason = reasonRaw;
    if (details.length > 500) return bad("Details can be up to 500 characters.");
    if (reason === "other" && details.length < 5) return bad("Tell us what happened.");

    const { data, role } = await getConversationForUser(conversationId, uid);

    await connectToDatabase();

    const existing = await ChatReport.exists({ reporterUid: uid, conversationId, status: "open" });
    if (existing) return bad("You already reported this chat. Our team is looking at it.", 409);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await ChatReport.countDocuments({ reporterUid: uid, createdAt: { $gte: since } });
    if (recent >= DAILY_LIMIT) return bad("You've sent several reports today. Please try again tomorrow.", 429);

    await ChatReport.create({
      reporterUid: uid,
      reporterRole: role,
      conversationId,
      companyId: String(data.companyId ?? ""),
      companyName: String(data.companyName ?? ""),
      clientUid: String(data.clientUid ?? ""),
      clientName: String(data.clientName ?? ""),
      reason,
      details,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("chat report error", err);
    return bad("Couldn't send the report. Try again.", 500);
  }
}