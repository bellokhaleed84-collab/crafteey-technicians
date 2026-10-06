import { NextRequest, NextResponse } from "next/server";
import Company from "@/models/Company";
import { AuthError } from "@/middleware/auth";
import { requireApprovedCompany } from "@/lib/companyAuth";
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

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * PATCH /api/company/profile
 * The owner edits what clients see. Business name, email, documents and the
 * agreement are not editable here.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { company } = await requireApprovedCompany(req);

    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

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

    if (!Array.isArray(body.photos) || body.photos.length > 8) {
      return bad("You can add up to 8 photos.");
    }
    const photos: string[] = [];
    for (const p of body.photos) {
      const u = cloudinaryUrl(p);
      if (!u) return bad("Photos must be uploaded through the app.");
      photos.push(u);
    }

    const set: Record<string, unknown> = {
      phone,
      trades,
      areas,
      description,
      yearsOperating,
      technicianCount,
      priceRange: body.priceRange,
      address,
      photos,
    };
    const unset: Record<string, ""> = {};

    if (body.logoUrl) {
      const l = cloudinaryUrl(body.logoUrl);
      if (!l) return bad("The logo must be uploaded through the app.");
      set.logoUrl = l;
    } else {
      unset.logoUrl = "";
    }

    await Company.updateOne(
      { _id: company._id },
      Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("company profile update error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}