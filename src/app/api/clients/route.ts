import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { calcCalorieTarget, calcMacroTargets } from "@/lib/nutrition";
import { addDays, todayISO } from "@/lib/units";
import type { ActivityLevel, Gender, Goal, Profile, UserDoc } from "@/lib/types";

export const runtime = "nodejs";

interface CreateClientBody {
  mode?: "manual" | "example";
  name?: string;
  email?: string;
  password?: string;
  profile?: Profile;
  goal?: Goal;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

function isValidProfile(p: Profile | undefined): p is Profile {
  return (
    !!p &&
    typeof p.age === "number" &&
    p.age > 0 &&
    typeof p.heightCm === "number" &&
    p.heightCm > 0 &&
    typeof p.weightKg === "number" &&
    p.weightKg > 0 &&
    (p.gender === "male" || p.gender === "female") &&
    ACTIVITY_LEVELS.includes(p.activityLevel)
  );
}

/** A random four-char suffix so example client emails don't collide. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(req: Request) {
  let decoded;
  try {
    decoded = await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const adminAuth = getAdminAuth();

  // The caller must be a coach.
  const coachSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const coach = coachSnap.data() as UserDoc | undefined;
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "Only coaches can add clients" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateClientBody;
  const isExample = body.mode === "example";

  // Resolve the client's identity, profile and goal — either supplied (manual)
  // or generated (example).
  let name: string;
  let email: string;
  let password: string;
  let profile: Profile;
  let goal: Goal;

  if (isExample) {
    name = "Alex Morgan (Example)";
    email = `alex.morgan.${randomSuffix()}@coachfit.example`;
    password = "Example123!";
    profile = {
      age: 29,
      gender: "female" as Gender,
      heightCm: 168,
      weightKg: 74,
      activityLevel: "moderate",
    };
    goal = { type: "cut", targetRatePerWeekKg: 0.45 };
  } else {
    name = (body.name || "").trim();
    email = (body.email || "").trim().toLowerCase();
    password = body.password || "";
    if (!name) {
      return NextResponse.json({ error: "A name is required" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "An email is required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }
    if (!isValidProfile(body.profile)) {
      return NextResponse.json(
        { error: "Complete profile information is required" },
        { status: 400 },
      );
    }
    profile = body.profile;
    goal = body.goal ?? { type: "maintain", targetRatePerWeekKg: 0 };
  }

  // Create the auth account.
  let uid: string;
  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 },
      );
    }
    if (code === "auth/invalid-email") {
      return NextResponse.json({ error: "That email is not valid" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Could not create the client account" },
      { status: 500 },
    );
  }

  const now = Date.now();
  const calorieTarget = calcCalorieTarget(profile, goal.type, goal.targetRatePerWeekKg);
  const macroTargets = calcMacroTargets(calorieTarget, profile.weightKg);

  const doc: UserDoc = {
    uid,
    role: "client",
    name,
    email,
    coachId: decoded.uid,
    profile,
    goal,
    calorieTarget,
    macroTargets,
    meeting: { frequency: "off" },
    weightUnit: coach.weightUnit ?? "lb",
    startWeightKg: profile.weightKg,
    currentWeightKg: profile.weightKg,
    ...(isExample ? { isExample: true } : {}),
    createdAt: now,
  };

  const batch = adminDb.batch();
  batch.set(adminDb.collection("users").doc(uid), doc);

  if (isExample) {
    seedExampleData(adminDb, batch, uid, profile.weightKg, calorieTarget, doc);
  }

  await batch.commit();

  return NextResponse.json({
    ok: true,
    uid,
    name,
    // Surface example credentials so the coach can also log in as the demo client.
    ...(isExample ? { email, password } : {}),
  });
}

/**
 * Seed ~9 weeks of weekly weigh-ins (trending toward the cut goal) and a few
 * days of food logs so charts, the dashboard and AI insights have data to show.
 * Mutates `batch` and updates the user doc's denormalized currentWeightKg.
 */
function seedExampleData(
  adminDb: ReturnType<typeof getAdminDb>,
  batch: FirebaseFirestore.WriteBatch,
  userId: string,
  startKg: number,
  calorieTarget: number,
  doc: UserDoc,
): void {
  const now = Date.now();
  const weights = adminDb.collection("weightEntries");

  // Ten weekly weigh-ins, ~0.4kg/week loss with mild noise.
  const noise = [0, -0.3, 0.2, -0.5, -0.1, -0.4, 0.1, -0.6, -0.2, -0.3];
  let latestKg = startKg;
  for (let i = 0; i < 10; i++) {
    const weeksAgo = 9 - i;
    const date = addDays(todayISO(), -weeksAgo * 7);
    const weightKg = Math.round((startKg - i * 0.4 + noise[i]) * 10) / 10;
    latestKg = weightKg;
    batch.set(weights.doc(), {
      userId,
      weightKg,
      date,
      createdAt: now - weeksAgo * 7 * 86400000,
    });
  }
  doc.currentWeightKg = latestKg;

  // A representative day's meals (~matching the calorie target), logged for the
  // last five days.
  const meals = [
    { meal: "breakfast", name: "Greek yogurt with berries & granola", calories: 320, proteinG: 24, carbsG: 38, fatG: 8 },
    { meal: "lunch", name: "Grilled chicken salad", calories: 450, proteinG: 40, carbsG: 30, fatG: 18 },
    { meal: "dinner", name: "Salmon, rice & broccoli", calories: 560, proteinG: 42, carbsG: 50, fatG: 20 },
    { meal: "snacks", name: "Protein shake & apple", calories: 250, proteinG: 26, carbsG: 28, fatG: 4 },
  ] as const;
  const foodLogs = adminDb.collection("foodLogs");
  void calorieTarget; // target is informational; seeded meals are fixed.
  for (let d = 0; d < 5; d++) {
    const date = addDays(todayISO(), -d);
    for (const m of meals) {
      batch.set(foodLogs.doc(), {
        userId,
        date,
        ...m,
        createdAt: now - d * 86400000,
      });
    }
  }
}
