import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { verifyToken, AuthError } from "@/middleware/auth";
import { isTradeCategory } from "@/lib/trades";
import { isCompanyArea, isPriceRange } from "@/lib/companyOptions";
import { containsContactInfo, CONTACT_INFO_MESSAGE } from "@/lib/contactCheck";

// Only https links on Cloudinary's host are accepted, which is what our
// signed upload returns. Anything else is rejected.
function cloudinaryUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value ?? "").trim());
    if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function cloudinaryList(value: unknown, max: number): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  const out: string[] = [];
  for (const v of value) {
    const u = cloudinaryUrl(v);
    if (!u) return null;
    out.push(u);
  }
  return out;
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    // Use the email Firebase verified, not one the client sent.
    const email = decoded.email?.toLowerCase();
    if (!email) return bad("Your account has no email address.");

    const businessName = String(body.businessName ?? "").trim();
    if (businessName.length < 2 || businessName.length > 80) {
      return bad("Enter your business name.");
    }

    const phone = String(body.phone ?? "").replace(/[\s-]/g, "");
    if (!/^\+?\d{10,15}$/.test(phone)) return bad("Enter a valid phone number.");

    const trades: string[] = Array.isArray(body.trades)
      ? Array.from(new Set(body.trades.map((t: unknown) => String(t))))
      : [];
    if (trades.length === 0 || !trades.every(isTradeCategory)) {
      return bad("Choose at least one service you provide.");
    }

    const areas: string[] = Array.isArray(body.areas)
      ? Array.from(new Set(body.areas.map((a: unknown) => String(a))))
      : [];
    if (areas.length === 0 || !areas.every(isCompanyArea)) {
      return bad("Choose at least one area you cover.");
    }

    const description = String(body.description ?? "").trim();
    if (description.length > 600) return bad("Description must be under 600 characters.");
    if (containsContactInfo(description)) return bad(`Your description ${CONTACT_INFO_MESSAGE.toLowerCase()}`);

    const yearsOperating = Number(body.yearsOperating);
    if (!Number.isInteger(yearsOperating) || yearsOperating < 0 || yearsOperating > 80) {
      return bad("Enter how many years you have operated.");
    }

    const technicianCount = Number(body.technicianCount);
    if (!Number.isInteger(technicianCount) || technicianCount < 1 || technicianCount > 500) {
      return bad("Enter how many technicians you have.");
    }

    if (!isPriceRange(body.priceRange)) return bad("Choose a price range.");

    const address = String(body.address ?? "").trim();
    if (address.length < 5 || address.length > 200) return bad("Enter your business address.");

    const photos = cloudinaryList(body.photos, 8);
    if (!photos) return bad("Photos must be uploaded through the app (up to 8).");

    const docs = body.documents ?? {};
    const businessRegistrationUrl = cloudinaryUrl(docs.businessRegistrationUrl);
    if (!businessRegistrationUrl) return bad("Upload your business registration document.");
    const idCardUrl = cloudinaryUrl(docs.idCardUrl);
    if (!idCardUrl) return bad("Upload your ID card.");
    const certificationUrls = cloudinaryList(docs.certificationUrls, 5);
    const otherUrls = cloudinaryList(docs.otherUrls, 5);
    if (!certificationUrls || !otherUrls) return bad("Documents must be uploaded through the app.");

    let logoUrl: string | undefined;
    if (body.logoUrl) {
      const l = cloudinaryUrl(body.logoUrl);
      if (!l) return bad("The logo must be uploaded through the app.");
      logoUrl = l;
    }

    const existing = await Company.findOne({ uid: decoded.uid }).lean();
    if (existing) {
      return NextResponse.json({ error: "Company profile already exists" }, { status: 409 });
    }

    const company = await Company.create({
      uid: decoded.uid,
      businessName,
      email,
      phone,
      trades,
      areas,
      description: description || undefined,
      yearsOperating,
      technicianCount,
      priceRange: body.priceRange,
      address,
      logoUrl,
      photos,
      documents: { businessRegistrationUrl, idCardUrl, certificationUrls, otherUrls },
      agreement: { signed: false },
      status: "pending",
      isApproved: false,
      verified: false,
      isOnline: false,
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if ((err as { code?: number } | null)?.code === 11000) {
      return NextResponse.json({ error: "Company profile already exists" }, { status: 409 });
    }
    console.error("company register error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}