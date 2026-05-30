import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { calcCalorieTarget, calcMacroTargets } from "@/lib/nutrition";
import type { Goal, Profile, Role, UserDoc } from "@/lib/types";

export const runtime = "nodejs";

function generateInviteCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uniqueInviteCode(
  adminDb: ReturnType<typeof getAdminDb>,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const existing = await adminDb
      .collection("users")
      .where("inviteCode", "==", code)
      .limit(1)
      .get();
    if (existing.empty) return code;
  }
  throw new Error("Could not generate a unique invite code");
}

interface OnboardingBody {
  role: Role;
  name?: string;
  coachPassword?: string;
  inviteCode?: string;
  profile?: Profile;
  goal?: Goal;
}

export async function POST(req: Request) {
  let decoded;
  try {
    decoded = await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const uid = decoded.uid;
  const userRef = adminDb.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists) {
    return NextResponse.json({ error: "Profile already exists" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as OnboardingBody;
  const name = (body.name || decoded.name || "").toString().trim() || "Unnamed";
  const email = (decoded.email || "").toString();
  const now = Date.now();

  if (body.role === "coach") {
    const expected = process.env.COACH_SIGNUP_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Coach signup is not configured" },
        { status: 500 },
      );
    }
    if (body.coachPassword !== expected) {
      return NextResponse.json({ error: "Incorrect coach password" }, { status: 403 });
    }
    const inviteCode = await uniqueInviteCode(adminDb);
    const doc: UserDoc = {
      uid,
      role: "coach",
      name,
      email,
      inviteCode,
      weightUnit: "lb",
      createdAt: now,
    };
    await userRef.set(doc);
    return NextResponse.json({ ok: true, role: "coach", inviteCode });
  }

  // Client onboarding
  const code = (body.inviteCode || "").toString().trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "An invite code is required" }, { status: 400 });
  }
  const coachSnap = await adminDb
    .collection("users")
    .where("inviteCode", "==", code)
    .where("role", "==", "coach")
    .limit(1)
    .get();
  if (coachSnap.empty) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }
  const coachId = coachSnap.docs[0].id;

  const profile = body.profile;
  if (
    !profile ||
    !profile.age ||
    !profile.heightCm ||
    !profile.weightKg ||
    !profile.gender ||
    !profile.activityLevel
  ) {
    return NextResponse.json(
      { error: "Complete profile information is required" },
      { status: 400 },
    );
  }

  const goal: Goal = body.goal ?? { type: "maintain", targetRatePerWeekKg: 0.5 };
  const calorieTarget = calcCalorieTarget(profile, goal.type, goal.targetRatePerWeekKg);
  const macroTargets = calcMacroTargets(calorieTarget, profile.weightKg);

  const doc: UserDoc = {
    uid,
    role: "client",
    name,
    email,
    coachId,
    profile,
    goal,
    calorieTarget,
    macroTargets,
    meeting: { frequency: "off" },
    weightUnit: "lb",
    createdAt: now,
  };
  await userRef.set(doc);
  return NextResponse.json({ ok: true, role: "client" });
}
