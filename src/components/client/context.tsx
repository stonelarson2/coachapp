"use client";

import * as React from "react";
import type { Role, UserDoc } from "@/lib/types";

export interface WorkspaceCtx {
  /** The user being viewed (a client). */
  target: UserDoc;
  /** The uid of the person viewing this workspace. */
  viewerId: string;
  /** The role of the person viewing this workspace. */
  viewerRole: Role;
  /** True when a coach is viewing one of their clients. */
  isCoachView: boolean;
  /** Display unit chosen by the viewer. */
  unit: "kg" | "lb";
  /** Energy label chosen by the viewer ("cal" or "kcal"). */
  energyUnit: "cal" | "kcal";
}

const Ctx = React.createContext<WorkspaceCtx | undefined>(undefined);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
