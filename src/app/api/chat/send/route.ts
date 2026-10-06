import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import BlockedMessage from "@/models/BlockedMessage";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getConversationForUser } from "@/lib/chatAccess";
import { checkMessage, CONTACT_LOCK_MESSAGE } from "@/lib/contactLock";

export const dynamic = "force-dynamic";

const MAX_LENGTH = 1000;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/chat/send  body: { conversationId, text }
 * The only way a message reaches Firestore. Checks the sender is in the chat,
 * runs the contact lock, then saves. Blocked text is never saved to the chat.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    const conversationId = String(body.conversationId ?? "");
    const text = String(body.text ?? "").trim();
    if (!text) return bad("Type a message first.");
    if (text.length > MAX_LENGTH) return bad(`Messages can be up to ${MAX_LENGTH} characters.`);

    const { ref, data, role } = await getConversationForUser(conversationId, decoded.uid);
    if (data.status === "closed") return bad("This chat is closed.", 403);

    await connectToDatabase();
    if (role === "company") {
      const approved = await Company.exists({ _id: data.companyId, status: "approved" });
      if (!approved) return bad("Your company is not active right now.", 403);
    }

    const result = checkMessage(text);
    if (result.blocked) {
      await BlockedMessage.create({
        uid: decoded.uid,
        role,
        conversationId,
        companyId: String(data.companyId),
        text,
        reason: result.reason,
      }).catch((e) => console.error("blocked log failed", e));
      return NextResponse.json(
        { error: CONTACT_LOCK_MESSAGE, blocked: true, reason: result.reason },
        { status: 422 }
      );
    }

    const msgRef = ref.collection("messages").doc();
    const batch = (await import("@/lib/firebaseAdmin")).adminDb.batch();
    batch.set(msgRef, {
      senderUid: decoded.uid,
      senderRole: role,
      type: "text",
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(ref, {
      lastMessage: text.slice(0, 120),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderRole: role,
      [role === "client" ? "unreadCompany" : "unreadClient"]: FieldValue.increment(1),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, id: msgRef.id });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("chat send error", err);
    return bad("Couldn't send your message. Try again.", 500);
  }
}