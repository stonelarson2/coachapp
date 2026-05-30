import type { UserDoc } from "./types";

/** The home path for a user after login, based on their role. */
export function homePathFor(profile: UserDoc): string {
  return profile.role === "coach" ? "/dashboard" : "/me";
}
