"use client";

// Client-side Firestore data access: realtime hooks + write helpers.
import * as React from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { getDb, getStorageInstance } from "@/lib/firebase/client";
import { emitFoodLogged } from "@/lib/streak";
import type {
  CheckinDoc,
  CheckinRatings,
  FavoriteFood,
  FoodLogEntry,
  InsightDoc,
  MealType,
  MessageDoc,
  PhotoDoc,
  UserDoc,
  WeightEntry,
} from "@/lib/types";

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
  emitFoodLogged({ userId, date });
}

export async function deleteFoodLog(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "foodLogs", id));
}

export async function importFoodLogs(
  userId: string,
  rows: import("./mfpImport").MfpRow[],
): Promise<void> {
  const db = getDb();
  // Firestore batches are capped at 500 writes.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const row of rows.slice(i, i + CHUNK)) {
      const ref = doc(collection(db, "foodLogs"));
      batch.set(ref, { userId, ...row, createdAt: Date.now() });
    }
    await batch.commit();
  }
}

// ---- Favorites & quick add ----

/** A lightweight food shape used for quick-add chips (recents + favorites). */
export interface QuickFood {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Realtime list of a user's favorite foods, newest first. */
export function useFavorites(userId: string | undefined) {
  const [favorites, setFavorites] = React.useState<FavoriteFood[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const q = query(collection(getDb(), "favorites"), where("userId", "==", userId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FavoriteFood);
        list.sort((a, b) => b.createdAt - a.createdAt);
        setFavorites(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { favorites, loading };
}

/** Add a favorite, skipping if one with the same name already exists. */
export async function addFavorite(userId: string, food: QuickFood): Promise<void> {
  const db = getDb();
  const existing = await getDocs(
    query(
      collection(db, "favorites"),
      where("userId", "==", userId),
      where("name", "==", food.name),
    ),
  );
  if (!existing.empty) return;
  await addDoc(collection(db, "favorites"), {
    userId,
    ...food,
    createdAt: Date.now(),
  });
}

export async function removeFavorite(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "favorites", id));
}

/**
 * Derive a user's recently-logged foods from food-log history: dedupe by name
 * (keeping the most recent), newest first, capped at `max`.
 */
export function recentFoods(entries: FoodLogEntry[], max = 12): QuickFood[] {
  const byName = new Map<string, FoodLogEntry>();
  for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = e.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, e);
    if (byName.size >= max) break;
  }
  return Array.from(byName.values()).map((e) => ({
    name: e.name,
    calories: e.calories,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
  }));
}

// ---- Photos ----

/** Realtime progress photos for a user, newest first. */
export function usePhotos(userId: string | undefined) {
  const [photos, setPhotos] = React.useState<PhotoDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(getDb(), "photos"),
      where("userId", "==", userId),
      orderBy("date", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PhotoDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { photos, loading };
}

export async function uploadPhoto(
  userId: string,
  file: File,
  date: string,
  note: string,
): Promise<void> {
  const path = `photos/${userId}/${Date.now()}-${file.name}`;
  const sref = storageRef(getStorageInstance(), path);
  await uploadBytes(sref, file);
  const url = await getDownloadURL(sref);
  await addDoc(collection(getDb(), "photos"), {
    userId,
    storagePath: path,
    url,
    date,
    note,
    createdAt: Date.now(),
  });
}

export async function deletePhoto(photo: PhotoDoc): Promise<void> {
  await deleteDoc(doc(getDb(), "photos", photo.id));
  try {
    await deleteObject(storageRef(getStorageInstance(), photo.storagePath));
  } catch {
    // Storage object may already be gone; ignore.
  }
}

// ---- Insights ----

/** Realtime list of saved AI insights for a user, newest first. */
export function useInsights(userId: string | undefined) {
  const [insights, setInsights] = React.useState<InsightDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(getDb(), "insights"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInsights(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InsightDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { insights, loading };
}

// ---- Messages ----

/** Realtime chat thread between a coach and a client, oldest first. */
export function useMessages(coachId: string | undefined, clientId: string | undefined) {
  const [messages, setMessages] = React.useState<MessageDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!coachId || !clientId) return;
    const q = query(
      collection(getDb(), "messages"),
      where("coachId", "==", coachId),
      where("clientId", "==", clientId),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MessageDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [coachId, clientId]);

  return { messages, loading };
}

export async function sendMessage(
  coachId: string,
  clientId: string,
  senderId: string,
  text: string,
): Promise<void> {
  await addDoc(collection(getDb(), "messages"), {
    coachId,
    clientId,
    senderId,
    text,
    createdAt: Date.now(),
  });
}

// ---- Weekly check-ins ----

/** Realtime check-ins for a user, newest week first. */
export function useCheckins(userId: string | undefined) {
  const [checkins, setCheckins] = React.useState<CheckinDoc[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(getDb(), "checkins"),
      where("userId", "==", userId),
      orderBy("weekOf", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCheckins(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CheckinDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [userId]);

  return { checkins, loading };
}

export interface CheckinInput {
  weekOf: string;
  weightKg?: number;
  ratings: CheckinRatings;
  notes: string;
}

export async function submitCheckin(
  userId: string,
  coachId: string | undefined,
  input: CheckinInput,
): Promise<void> {
  await addDoc(collection(getDb(), "checkins"), {
    userId,
    ...(coachId ? { coachId } : {}),
    ...input,
    createdAt: Date.now(),
  });
}

/** Coach replies to a client's check-in. */
export async function replyToCheckin(id: string, reply: string): Promise<void> {
  await updateDoc(doc(getDb(), "checkins", id), {
    coachReply: reply,
    coachRepliedAt: Date.now(),
  });
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
