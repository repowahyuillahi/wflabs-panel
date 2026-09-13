import React, { useState } from "react";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface UsageTimelineChartProps {
  timeline: Array<{
    timestamp: string;
    tokens: number;
    costUsd: number;
  }>;
  metric: "tokens" | "cost";
  period: string;
}

export function UsageTimelineChart({ timeline, metric, period }: UsageTimelineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center text-xs text-muted-foreground font-mono">
        No telemetry buckets available for {period}
      </div>
    );
  }

  const isTokens = metric === "tokens";
  const values = timeline.map((b) => (isTokens ? b.tokens : b.costUsd));
  const maxVal = Math.max(...values, isTokens ? 1000 : 0.01);
  const totalVal = values.reduce((a, b) => a + b, 0);

  // Find peak bucket
  let peakIndex = 0;
  values.forEach((v, idx) => {
    if (v > values[peakIndex]) peakIndex = idx;
  });
  const peakBucket = timeline[peakIndex];

  return (
    <div className="space-y-3 select-none">
      {/* Mini Telemetry Bar summary */}
      <div className="flex items-center justify-between text-xs font-mono px-1">
        <div className="text-muted-foreground">
          Bucket Peak:{" "}
          <strong className="text-foreground">
            {isTokens ? formatNumber(values[peakIndex]) + " tok" : formatCurrency(values[peakIndex])}
          </strong>{" "}
          at <span className="font-bold text-primary">{peakBucket?.timestamp || "-"}</span>
        </div>
        <div className="text-muted-foreground">
          Total:{" "}
          <strong className="text-emerald-600 dark:text-emerald-400">
            {isTokens ? formatNumber(totalVal) + " tok" : formatCurrency(totalVal)}
          </strong>
        </div>
      </div>

      {/* 24-Hour / Periodic Columns Track */}
      <div className="relative h-48 w-full rounded-xl border border-border bg-card/60 p-3 flex flex-col justify-between overflow-hidden shadow-2xs">
        {/* Horizontal Reference Grid lines */}
        <div className="absolute inset-x-3 top-3 bottom-8 flex flex-col justify-between pointer-events-none opacity-15">
          <div className="border-b border-foreground w-full" />
          <div className="border-b border-foreground w-full" />
          <div className="border-b border-foreground w-full" />
          <div className="border-b border-foreground w-full" />
        </div>

        {/* The Columns Frame */}
        <div className="flex-1 flex items-end gap-1 sm:gap-1.5 z-10 pt-2 pb-1 overflow-x-auto">
          {timeline.map((b, idx) => {
            const val = isTokens ? b.tokens : b.costUsd;
            const pct = Math.max(val > 0 ? 6 : 2, Math.round((val / maxVal) * 100));
            const isHovered = hoveredIndex === idx;
            const hasActivity = val > 0;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="flex-1 min-w-[12px] h-full flex flex-col justify-end items-center group cursor-pointer relative"
              >
                {/* Tooltip Popup on Hover */}
                {isHovered && (
                  <div className="absolute -top-12 z-30 pointer-events-none whitespace-nowrap rounded-md bg-foreground text-background text-[11px] font-mono px-2.5 py-1 shadow-lg flex flex-col items-center">
                    <span className="font-bold">{b.timestamp}</span>
                    <span>{isTokens ? `${formatNumber(val)} tokens` : formatCurrency(val)}</span>
                    <div className="w-2 h-2 bg-foreground rotate-45 -mb-1 mt-0.5" />
                  </div>
                )}

                {/* The Bar */}
                <div
                  className={`w-full rounded-t-xs transition-all duration-300 ${
                    hasActivity
                      ? isTokens
                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-sm"
                        : "bg-gradient-to-t from-sky-600 to-cyan-400 shadow-sm"
                      : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
                  } ${isHovered ? "ring-2 ring-primary brightness-125 scale-x-110" : ""}`}
                  style={{
                    height: `${pct}%`,
                    boxShadow: hasActivity && isHovered ? "0 0 10px rgba(16, 185, 129, 0.5)" : "none",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* X-Axis Hourly / Time Labels */}
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-muted-foreground border-t border-border/80 pt-1 px-0.5">
          {timeline.map((b, idx) => {
            // For 24 hourly buckets, show every 2nd or 3rd on small screens, or all if enough room
            const showLabel =
              timeline.length <= 12 ||
              idx === 0 ||
              idx === timeline.length - 1 ||
              idx % (timeline.length > 24 ? 4 : 2) === 0;

            return (
              <span
                key={idx}
                className={`flex-1 text-center truncate ${showLabel ? "opacity-100" : "opacity-0"} ${
                  hoveredIndex === idx ? "font-bold text-foreground" : ""
                }`}
              >
                {b.timestamp}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
