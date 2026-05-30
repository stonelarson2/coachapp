// Client helper for calling our server API routes with the Firebase ID token.
import { auth } from "@/lib/firebase/client";

export async function authedFetch<T = unknown>(
  url: string,
  body: unknown,
  method: "POST" | "PUT" = "POST",
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
  }
  return data as T;
}
