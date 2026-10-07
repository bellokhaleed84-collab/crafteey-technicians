import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { connectToDatabase } from "@/lib/mongodb";
import { adminDb } from "@/lib/firebaseAdmin";
import Company from "@/models/Company";
import Quote from "@/models/Quote";
import BlockedMessage from "@/models/BlockedMessage";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getConversationForUser } from "@/lib/chatAccess";
import { checkMessage, CONTACT_LOCK_MESSAGE } from "@/lib/contactLock";
import { getCompanyCommissionPercent } from "@/lib/companyCommission";
import { QUOTE_LIMITS as L, splitKobo, nairaText } from "@/lib/quoteShared";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/quotes/create
 * body: { conversationId, title, description, totalKobo, items?, expiresAt, kind?, reason? }
 * The company owner sends a quotation into a chat. The server works out the
 * commission split. The chat message holds only the quote id.
 */
export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    const conversationId = String(body.conversationId ?? "");
    const kind = body.kind === "additional" ? "additional" : "main";
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const totalKobo = Number(body.totalKobo);
    const expiresAt = new Date(String(body.expiresAt ?? ""));
    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    if (title.length < 3 || title.length > L.maxTitle) return bad("Give the quotation a short title.");
    if (description.length < 5 || description.length > L.maxDescription) {
      return bad("Describe the work in a few words (up to 600 characters).");
    }
    if (kind === "additional" && (reason.length < 5 || reason.length > L.maxReason)) {
      return bad("Say why the extra cost is needed.");
    }
    if (!Number.isInteger(totalKobo) || totalKobo < L.minKobo || totalKobo > L.maxKobo) {
      return bad(`The total must be between ${nairaText(L.minKobo)} and ${nairaText(L.maxKobo)}.`);
    }
    const now = Date.now();
    if (
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() < now + L.minExpiryMs ||
      expiresAt.getTime() > now + L.maxExpiryMs
    ) {
      return bad("Pick an expiry between 1 hour and 30 days from now.");
    }

    if (rawItems.length > L.maxItems) return bad(`Up to ${L.maxItems} breakdown lines.`);
    const items: { label: string; amountKobo: number }[] = [];
    for (const raw of rawItems) {
      const it = raw as { label?: unknown; amountKobo?: unknown } | null;
      const label = String(it?.label ?? "").trim();
      const amountKobo = Number(it?.amountKobo);
      if (!label || label.length > L.maxLabel || !Number.isInteger(amountKobo) || amountKobo <= 0) {
        return bad("Check the breakdown lines.");
      }
      items.push({ label, amountKobo });
    }
    if (items.length > 0 && items.reduce((s, i) => s + i.amountKobo, 0) !== totalKobo) {
      return bad("The breakdown must add up to the total.");
    }

    const { ref, data, role } = await getConversationForUser(conversationId, decoded.uid);
    if (role !== "company") return bad("Only the company can send a quotation.", 403);
    if (data.status === "closed") return bad("This chat is closed.", 403);

    await connectToDatabase();
    const isOwner = await Company.exists({ _id: data.companyId, uid: decoded.uid, status: "approved" });
    if (!isOwner) return bad("Only your company's owner can send a quotation.", 403);

    if (kind === "additional") {
      const hasPaid = await Quote.exists({ conversationId, kind: "main", status: "paid" });
      if (!hasPaid) return bad("An additional quotation needs a paid job first.");
    }

    // Contact lock on every piece of free text.
    for (const t of [title, description, reason, ...items.map((i) => i.label)]) {
      if (!t) continue;
      const result = checkMessage(t);
      if (result.blocked) {
        await BlockedMessage.create({
          uid: decoded.uid,
          role: "company",
          conversationId,
          companyId: String(data.companyId),
          text: t,
          reason: result.reason,
        }).catch((e) => console.error("blocked log failed", e));
        return NextResponse.json(
          { error: CONTACT_LOCK_MESSAGE, blocked: true, reason: result.reason },
          { status: 422 }
        );
      }
    }

    const percent = await getCompanyCommissionPercent();
    const { commissionKobo, companyEarningKobo } = splitKobo(totalKobo, percent);
    const msgRef = ref.collection("messages").doc();

    const quote = await Quote.create({
      conversationId,
      messageId: msgRef.id,
      companyId: data.companyId,
      clientUid: data.clientUid,
      createdByUid: decoded.uid,
      kind,
      reason: kind === "additional" ? reason : undefined,
      title,
      description,
      items,
      totalKobo,
      commissionPercent: percent,
      commissionKobo,
      companyEarningKobo,
      expiresAt,
      status: "sent",
    });

    try {
      const text = `Quotation: ${title}`;
      const batch = adminDb.batch();
      batch.set(msgRef, {
        senderUid: decoded.uid,
        senderRole: "company",
        type: "quote",
        quoteId: String(quote._id),
        text,
        createdAt: FieldValue.serverTimestamp(),
      });
      batch.update(ref, {
        lastMessage: text.slice(0, 120),
        lastMessageAt: FieldValue.serverTimestamp(),
        lastSenderRole: "company",
        unreadClient: FieldValue.increment(1),
      });
      await batch.commit();
    } catch (e) {
      await Quote.deleteOne({ _id: quote._id });
      throw e;
    }

    // A new price replaces any older unpaid quote of the same kind in this chat.
    await Quote.updateMany(
      { conversationId, kind, status: "sent", _id: { $ne: quote._id } },
      { $set: { status: "cancelled", statusAt: new Date() } }
    );

    return NextResponse.json({ ok: true, quoteId: String(quote._id) });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("quote create error", err);
    return bad("Couldn't send the quotation. Try again.", 500);
  }
}