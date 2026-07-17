"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useUserDoc } from "@/lib/data";
import { Badge, Spinner } from "@/components/ui";
import { Tabs, type TabDef } from "@/components/Tabs";
import { StreakCelebration } from "@/components/StreakCelebration";
import { WorkspaceProvider } from "./context";
import { OverviewTab } from "./tabs/OverviewTab";
import { ClientDetailTab } from "./tabs/ClientDetailTab";
import { ProgressTab } from "./tabs/ProgressTab";
import { WeekTab } from "./tabs/WeekTab";
import { FoodLogTab } from "./tabs/FoodLogTab";
import { NutritionTab } from "./tabs/NutritionTab";
import { MeetingTab } from "./tabs/MeetingTab";
import { CheckinTab } from "./tabs/CheckinTab";
import { MessageTab } from "./tabs/MessageTab";
import { PhotoTab } from "./tabs/PhotoTab";
import { InsightTab } from "./tabs/InsightTab";
import { BillingTab } from "./tabs/BillingTab";

/**
 * The tabbed per-client workspace, shared by:
 *  - a coach viewing a client (/clients/[id])
 *  - a client viewing themselves (/me)
 */
export function ClientWorkspace({ userId }: { userId: string }) {
  const { profile } = useAuth();
  const { data: target, loading } = useUserDoc(userId);

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }
  if (!target || !profile) {
    return <p className="text-sm text-gray-500">Client not found.</p>;
  }

  const isCoachView = profile.role === "coach";
  const unit = profile.weightUnit ?? "lb";
  const energyUnit = profile.energyUnit ?? "cal";

  const tabs: TabDef[] = [
    { id: "overview", label: "Overview", content: <OverviewTab /> },
    { id: "progress", label: "Progress", content: <ProgressTab /> },
    { id: "week", label: "This Week", content: <WeekTab /> },
    { id: "checkin", label: "Check-ins", content: <CheckinTab /> },
    { id: "detail", label: "Client Detail", content: <ClientDetailTab /> },
    { id: "food", label: "Food Log", content: <FoodLogTab /> },
    { id: "nutrition", label: "Nutrition Plan", content: <NutritionTab /> },
    { id: "meeting", label: "Meetings", content: <MeetingTab /> },
    { id: "message", label: "Messages", content: <MessageTab /> },
    { id: "photo", label: "Photos", content: <PhotoTab /> },
    { id: "insight", label: "Insights", content: <InsightTab /> },
    { id: "billing", label: "Billing", content: <BillingTab /> },
  ];

  return (
    <WorkspaceProvider
      value={{ target, viewerId: profile.uid, viewerRole: profile.role, isCoachView, unit, energyUnit }}
    >
      {!isCoachView && <StreakCelebration userId={target.uid} />}
      <div className="space-y-4">
        {isCoachView && (
          <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
            ← Back to dashboard
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {isCoachView ? target.name : "My Progress"}
          </h1>
          <Badge
            color={
              target.goal?.type === "cut"
                ? "amber"
                : target.goal?.type === "bulk"
                  ? "indigo"
                  : "gray"
            }
          >
            {target.goal?.type ?? "maintain"}
          </Badge>
        </div>
        <Tabs tabs={tabs} />
      </div>
    </WorkspaceProvider>
  );
}
