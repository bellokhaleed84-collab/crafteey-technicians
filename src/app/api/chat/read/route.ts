import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getConversationForUser } from "@/lib/chatAccess";

export const dynamic = "force-dynamic";

/** POST /api/chat/read  body: { conversationId }. Clears this side's unread count. */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const body = await req.json().catch(() => null);
    const { ref, role } = await getConversationForUser(String(body?.conversationId ?? ""), decoded.uid);
    await ref.update({ [role === "client" ? "unreadClient" : "unreadCompany"]: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("chat read error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}