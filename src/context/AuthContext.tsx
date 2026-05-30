"use client";

// Provides the current auth user + their Firestore profile document to the app.
import * as React from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { UserDoc } from "@/lib/types";

interface AuthState {
  user: User | null;
  /** Firestore profile doc, or null if the user hasn't completed onboarding. */
  profile: UserDoc | null;
  /** True until both auth state and (if signed in) the profile doc have loaded. */
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserDoc | null>(null);
  const [authResolved, setAuthResolved] = React.useState(false);
  const [profileResolved, setProfileResolved] = React.useState(false);

  React.useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthResolved(true);
      if (!u) {
        setProfile(null);
        setProfileResolved(true);
      } else {
        setProfileResolved(false);
      }
    });
  }, []);

  // Subscribe to the user's profile document in real time.
  React.useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserDoc) : null);
        setProfileResolved(true);
      },
      () => setProfileResolved(true),
    );
    return unsub;
  }, [user]);

  const signup = React.useCallback(
    async (name: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      return cred.user;
    },
    [],
  );

  const login = React.useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }, []);

  const logout = React.useCallback(async () => {
    await signOut(auth);
  }, []);

  const loading = !authResolved || (!!user && !profileResolved);

  const value: AuthState = { user, profile, loading, signup, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
