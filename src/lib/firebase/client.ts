// Firebase client SDK initialization (browser).
// Config comes from NEXT_PUBLIC_* env vars (safe to expose to the browser).
//
// Everything is lazily initialized so that importing this module during SSR /
// `next build` prerendering never calls getAuth()/getFirestore() (which would
// throw if env vars are absent). All consumers run in the browser.

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const app = getFirebaseApp();
    try {
      // Explicitly persist the session across browser restarts (IndexedDB, then
      // localStorage). Without this, some browser environments fall back to
      // in-memory persistence and the user is logged out every time they reopen.
      authInstance = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      });
    } catch {
      // Auth was already initialized for this app (e.g. Fast Refresh) — reuse it.
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getFirebaseApp());
  return dbInstance;
}

export function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) storageInstance = getStorage(getFirebaseApp());
  return storageInstance;
}
