"use client";

// Client-side Firestore data access: realtime hooks + write helpers.
import * as React from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { FoodLogEntry, MealType, UserDoc, WeightEntry } from "@/lib/types";

/** Realtime list of clients linked to a coach. */
export function useClients(coachId: string | undefined) {
  const [clients, setClients] = React.useState<UserDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!coachId) return;
    const q = query(collection(getDb(), "users"), where("coachId", "==", coachId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserDoc);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setClients(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [coachId]);

  return { clients, loading };
}

/** Realtime single user document (used for the per-client view). */
export function useUserDoc(uid: string | undefined) {
  const [data, setData] = React.useState<UserDoc | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(getDb(), "users", uid),
      (snap) => {
        setData(snap.exists() ? (snap.data() as UserDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  return { data, loading };
}

/** Realtime weight entries for a user, ordered by date ascending. */
export function useWeightEntries(userId: string | undefined) {
  const [entries, setEntries] = React.useState<WeightEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(getDb(), "weightEntries"),
      where("userId", "==", userId),
      orderBy("date", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WeightEntry));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { entries, loading };
}

// ---- Write helpers ----

/**
 * Add or update a weight entry for a date, and keep the denormalized
 * currentWeightKg on the user doc in sync.
 */
export async function logWeight(
  userId: string,
  weightKg: number,
  date: string,
  existing: WeightEntry[],
): Promise<void> {
  const db = getDb();
  const sameDay = existing.find((e) => e.date === date);
  if (sameDay) {
    await updateDoc(doc(db, "weightEntries", sameDay.id), { weightKg });
  } else {
    await addDoc(collection(db, "weightEntries"), {
      userId,
      weightKg,
      date,
      createdAt: Date.now(),
    });
  }
  // Recompute current weight = latest by date (including this new value).
  const merged = existing.filter((e) => e.date !== date).concat([
    { id: "tmp", userId, weightKg, date, createdAt: Date.now() },
  ]);
  merged.sort((a, b) => a.date.localeCompare(b.date));
  const latest = merged[merged.length - 1];
  await updateDoc(doc(db, "users", userId), { currentWeightKg: latest.weightKg });
}

export async function deleteWeightEntry(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "weightEntries", id));
}

/** Update arbitrary fields on a user document. */
export async function updateUserFields(
  uid: string,
  fields: Partial<UserDoc>,
): Promise<void> {
  await updateDoc(doc(getDb(), "users", uid), fields);
}

// ---- Food log ----

/** Realtime food log entries for a user on a given ISO date. */
export function useFoodLog(userId: string | undefined, date: string) {
  const [entries, setEntries] = React.useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const q = query(
      collection(getDb(), "foodLogs"),
      where("userId", "==", userId),
      where("date", "==", date),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLogEntry);
        list.sort((a, b) => a.createdAt - b.createdAt);
        setEntries(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId, date]);

  return { entries, loading };
}

/** Realtime food log entries for a user from `startDate` (inclusive) onward. */
export function useFoodLogRange(userId: string | undefined, startDate: string) {
  const [entries, setEntries] = React.useState<FoodLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const q = query(
      collection(getDb(), "foodLogs"),
      where("userId", "==", userId),
      where("date", ">=", startDate),
      orderBy("date", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLogEntry));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId, startDate]);

  return { entries, loading };
}

export interface FoodLogInput {
  meal: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function addFoodLog(
  userId: string,
  date: string,
  input: FoodLogInput,
): Promise<void> {
  await addDoc(collection(getDb(), "foodLogs"), {
    userId,
    date,
    ...input,
    createdAt: Date.now(),
  });
}

export async function deleteFoodLog(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "foodLogs", id));
}

/** Sum macros + calories across food log entries. */
export function sumMacros(entries: FoodLogEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}
