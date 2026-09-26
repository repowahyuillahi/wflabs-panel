import React, { useState } from "react";
import { UsageOverview } from "./usage/UsageOverview";
import { UsageDetails } from "./usage/UsageDetails";
import { cn } from "@/lib/utils";

type UsageTab = "overview" | "details";

export function UsageView() {
  const [tab, setTab] = useState<UsageTab>("overview");
  const [period, setPeriod] = useState("today");

  return (
    <div className="flex min-w-0 flex-col gap-6 max-w-7xl mx-auto pb-8 px-1 sm:px-0">
      {/* Tab switcher */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full sm:w-auto">
          {(["overview", "details"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "inline-flex flex-1 sm:flex-none items-center justify-center whitespace-nowrap rounded-md px-4 py-1 text-xs font-semibold capitalize transition-all",
                tab === t
                  ? "bg-background text-foreground shadow-2xs"
                  : "hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <UsageOverview period={period} setPeriod={setPeriod} />
      ) : (
        <UsageDetails />
      )}
    </div>
  );
}
