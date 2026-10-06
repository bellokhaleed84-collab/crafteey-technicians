import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token sent in the Authorization header
 * (format: "Bearer <token>") on API routes. Throws AuthError on failure.
 */
export async function verifyToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    throw new AuthError("Missing auth token");
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded; // decoded.uid is the Firebase uid
  } catch (err) {
    throw new AuthError("Invalid or expired token");
  }
}
