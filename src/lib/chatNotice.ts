import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

/** A grey system line in the chat, and one unread for the customer. Never throws. */
export async function postClientNotice(conversationId: string, text: string, quoteId?: string) {
  try {
    const ref = adminDb.collection("conversations").doc(conversationId);
    const batch = adminDb.batch();
    batch.set(ref.collection("messages").doc(), {
      senderUid: "system",
      senderRole: "system",
      type: "system",
      ...(quoteId ? { quoteId } : {}),
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(ref, {
      lastMessage: text.slice(0, 120),
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderRole: "system",
      unreadClient: FieldValue.increment(1),
    });
    await batch.commit();
  } catch (e) {
    console.error("chat notice failed", e);
  }
}