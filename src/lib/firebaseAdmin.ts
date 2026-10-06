import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function readEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = readEnv("FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL");
  const rawKey = readEnv("FIREBASE_ADMIN_PRIVATE_KEY", "FIREBASE_PRIVATE_KEY");

  // Remove wrapping quotes if present, then turn literal \n into real newlines
  const privateKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  const missing: string[] = [];
  if (!projectId) missing.push("FIREBASE_ADMIN_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!privateKey) missing.push("FIREBASE_ADMIN_PRIVATE_KEY");

  if (missing.length) {
    throw new Error(
      `Firebase Admin is not configured. Missing env variables in .env.local: ${missing.join(", ")}`
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminAuth = getAuth(getAdminApp());
export const adminDb = getFirestore(getAdminApp());