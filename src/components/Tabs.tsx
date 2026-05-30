"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: TabDef[];
  defaultTab?: string;
}) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="py-6">{current?.content}</div>
    </div>
  );
}
