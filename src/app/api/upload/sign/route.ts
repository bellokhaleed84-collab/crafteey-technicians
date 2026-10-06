import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { generateUploadSignature, CLOUD_NAME } from "@/lib/cloudinary";

const FOLDERS = {
  product: "crafteey/vendor-products",
  logo: "crafteey/vendor-logos",
} as const;

export async function POST(req: NextRequest) {
  try {
    await verifyToken(req);

    const apiKey = process.env.CLOUDINARY_API_KEY;
    if (!CLOUD_NAME || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Image upload isn't configured" }, { status: 500 });
    }

    // Optional body: { kind: "logo" }. No body (existing product uploads)
    // falls back to the product folder.
    const body = await req.json().catch(() => null);
    const folder = body?.kind === "logo" ? FOLDERS.logo : FOLDERS.product;

    const { timestamp, signature } = generateUploadSignature({ folder });
    return NextResponse.json({ cloudName: CLOUD_NAME, apiKey, timestamp, signature, folder });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("upload sign error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}