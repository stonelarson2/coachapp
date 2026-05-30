// Server-side helper: verify the Firebase ID token from the Authorization header.
import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function verifyRequest(req: Request): Promise<DecodedIdToken> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new Error("Missing Authorization bearer token");
  return adminAuth.verifyIdToken(match[1]);
}
