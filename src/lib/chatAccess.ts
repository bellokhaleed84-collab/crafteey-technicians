import { adminDb } from "@/lib/firebaseAdmin";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import CompanyStaff from "@/models/CompanyStaff";
import { AuthError } from "@/middleware/auth";

export type ChatRole = "client" | "company";

/** Loads a conversation and checks this person is in it. Anyone else gets "not found". */
export async function getConversationForUser(conversationId: string, uid: string) {
  if (!conversationId || conversationId.includes("/")) throw new AuthError("Chat not found", 404);
  const ref = adminDb.collection("conversations").doc(conversationId);
  const snap = await ref.get();
  const data = snap.data();
  if (!data || !Array.isArray(data.participantUids) || !data.participantUids.includes(uid)) {
    throw new AuthError("Chat not found", 404);
  }
  const role: ChatRole = data.clientUid === uid ? "client" : "company";
  return { ref, data, role };
}

/** The company owner's uid plus every ACTIVE staff member's uid. */
export async function companyUids(companyId: string): Promise<string[]> {
  await connectToDatabase();
  const company = await Company.findById(companyId).select("uid").lean();
  if (!company) return [];
  const staff = await CompanyStaff.find({
    companyId,
    status: "active",
    staffUid: { $exists: true },
  })
    .select("staffUid")
    .lean();
  return [company.uid, ...staff.map((s) => s.staffUid as string).filter(Boolean)];
}

/**
 * Firestore rules can't look inside MongoDB, so each conversation carries its
 * own list of who may read it. Call this whenever staff join or are removed.
 */
export async function syncCompanyParticipants(companyId: string) {
  const uids = await companyUids(companyId);
  if (uids.length === 0) return;
  const snap = await adminDb.collection("conversations").where("companyId", "==", companyId).get();

  let batch = adminDb.batch();
  let count = 0;
  for (const d of snap.docs) {
    const clientUid = d.data().clientUid as string;
    batch.update(d.ref, { participantUids: Array.from(new Set([clientUid, ...uids])) });
    count++;
    if (count === 400) {
      await batch.commit();
      batch = adminDb.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}