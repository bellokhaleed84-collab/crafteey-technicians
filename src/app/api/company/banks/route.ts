import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { getCompanyAccess } from "@/lib/companyAccess";
import { listBanks } from "@/lib/paystackTransfers";

export const dynamic = "force-dynamic";

let cached: { name: string; code: string }[] | null = null;
let cachedAt = 0;
const TTL_MS = 60 * 60 * 1000;

/** GET /api/company/banks : Nigerian banks for the account form. Owner only. */
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    const access = await getCompanyAccess(decoded.uid);
    if (!access.isOwner) return NextResponse.json({ error: "Only the owner can do this." }, { status: 403 });

    if (!cached || Date.now() - cachedAt > TTL_MS) {
      cached = await listBanks();
      cachedAt = Date.now();
    }
    return NextResponse.json({ banks: cached });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("banks error", err);
    return NextResponse.json({ error: "Couldn't load the bank list." }, { status: 500 });
  }
}