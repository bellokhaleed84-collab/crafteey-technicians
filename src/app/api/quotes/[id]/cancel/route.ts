import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { FieldValue } from "firebase-admin/firestore";
import { connectToDatabase } from "@/lib/mongodb";
import { adminDb } from "@/lib/firebaseAdmin";
import Company from "@/models/Company";
import Quote from "@/models/Quote";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getConversationForUser } from "@/lib/chatAccess";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** POST /api/quotes/[id]/cancel: the owner withdraws an unpaid quote. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = await verifyToken(req);
    if (!mongoose.isValidObjectId(params.id)) return bad("Invalid quotation id");
    await connectToDatabase();

    const quote = await Quote.findById(params.id);
    if (!quote) return bad("Quotation not found", 404);

    const { ref, role } = await getConversationForUser(quote.conversationId, decoded.uid);
    if (role !== "company") return bad("Quotation not found", 404);
    const isOwner = await Company.exists({ _id: quote.companyId, uid: decoded.uid, status: "approved" });
    if (!isOwner) return bad("Only your company's owner can cancel a quotation.", 403);

    const updated = await Quote.findOneAndUpdate(
      { _id: quote._id, status: "sent" },
      { $set: { status: "cancelled", statusAt: new Date() } },
      { new: true }
    );
    if (!updated) return bad("This quotation can't be cancelled (already paid, declined or expired).", 409);

    try {
      const text = `Quotation cancelled: ${quote.title}`;
      const batch = adminDb.batch();
      batch.set(ref.collection("messages").doc(), {
        senderUid: "system",
        senderRole: "system",
        type: "system",
        quoteId: String(quote._id),
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
      console.error("quote cancel notice failed", e);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("quote cancel error", err);
    return bad("Couldn't cancel the quotation. Try again.", 500);
  }
}