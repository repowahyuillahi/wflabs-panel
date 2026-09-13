import React from "react";
import {
  Gauge,
  KeyRound,
  Radio,
  Workflow,
  Sparkles,
  Boxes,
  Users2,
  SlidersHorizontal,
  CircleDollarSign,
  AlertTriangle,
  Sliders,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Activity,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { LiveInstanceResponse } from "@/lib/api";

export type AdminRoute =
  | "dashboard"
  | "accounts"
  | "providers"
  | "proxies"
  | "models"
  | "custom"
  | "members"
  | "quotas"
  | "pricing"
  | "errors"
  | "settings"
  | "docs";

interface AppSidebarProps {
  currentRoute: AdminRoute;
  onRouteChange: (route: AdminRoute) => void;
  live: LiveInstanceResponse | null;
}

interface NavSection {
  group: string;
  items: {
    id: AdminRoute;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[];
}

export function AppSidebar({ currentRoute, onRouteChange, live }: AppSidebarProps) {
  const isOnline = live?.live?.ping?.ok ?? false;
  const latency = live?.live?.ping?.latency ?? 0;

  const sections: NavSection[] = [
    {
      group: "Overview & Telemetry",
      items: [
        { id: "dashboard", label: "Dashboard", icon: <Gauge className="w-4 h-4 stroke-[1.75]" /> },
        { id: "errors", label: "Error Stream", icon: <AlertTriangle className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Upstream & Routing",
      items: [
        { id: "accounts", label: "Key Management", icon: <KeyRound className="w-4 h-4 stroke-[1.75]" /> },
        { id: "providers", label: "Providers", icon: <Radio className="w-4 h-4 stroke-[1.75]" /> },
        { id: "proxies", label: "Proxy Pools", icon: <Workflow className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Models & Mappings",
      items: [
        { id: "models", label: "Allowed Models", icon: <Sparkles className="w-4 h-4 stroke-[1.75]" /> },
        { id: "custom", label: "Custom Models", icon: <Boxes className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Consumers & Billing",
      items: [
        { id: "members", label: "Members & Keys", icon: <Users2 className="w-4 h-4 stroke-[1.75]" /> },
        { id: "quotas", label: "Quota Limits", icon: <SlidersHorizontal className="w-4 h-4 stroke-[1.75]" /> },
        { id: "pricing", label: "Pricing Matrix", icon: <CircleDollarSign className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Documentation & API",
      items: [
        { id: "docs", label: "Quickstart & Docs", icon: <BookOpen className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Configuration",
      items: [
        { id: "settings", label: "Settings & Backup", icon: <Sliders className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
  ];

  return (
    <aside className="w-64 min-w-[16rem] bg-sidebar border-r border-sidebar-border flex flex-col h-screen select-none font-sans">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-sidebar-border flex items-center gap-3.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-background border border-border shadow-xs">
          <img src="/wflabs-logo-black-256.png" alt="WFLabs" className="w-6 h-6 object-contain dark:hidden" />
          <img src="/wflabs-logo-white-256.png" alt="WFLabs" className="w-6 h-6 object-contain hidden dark:block" />
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-bold tracking-tight text-sidebar-foreground flex items-center gap-2">
            <span>WFLABS ADMIN</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              v2.1
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-normal">AI Gateway Control</div>
        </div>
      </div>

      {/* Gateway Live Status Indicator */}
      <div className="mx-3 my-2.5 px-3 py-2 rounded-lg border border-border bg-card shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              isOnline ? "bg-emerald-400" : "bg-destructive"
            )} />
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              isOnline ? "bg-emerald-500" : "bg-destructive"
            )} />
          </span>
          <span className="text-muted-foreground font-medium">Gateway :20128</span>
        </div>
        <span className={cn(
          "font-mono font-medium text-xs",
          isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
        )}>
          {isOnline ? `${latency}ms` : "OFFLINE"}
        </span>
      </div>

      {/* Grouped Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider font-mono">
              {sec.group}
            </div>
            {sec.items.map((item) => {
              const active = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onRouteChange(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "transition-colors",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                    )}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {active && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              );
            })}
          </div>
        ))}

        {/* Portals Section */}
        <div className="space-y-1 pt-1">
          <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider font-mono">
            External Portals
          </div>
          <a
            href="/member"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <ExternalLink className="w-4 h-4 text-cyan-600 dark:text-cyan-400 stroke-[1.75]" />
              <span>Member Portal</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              portal
            </span>
          </a>

          <a
            href="/status"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
              <span>System Status</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              live
            </span>
          </a>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-sidebar-border bg-sidebar text-xs text-muted-foreground space-y-1 font-mono">
        <div className="flex justify-between items-center">
          <span className="font-sans text-muted-foreground">Gateway PID</span>
          <span className="font-semibold text-sidebar-foreground">{live?.live?.pid || "-"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-sans text-muted-foreground">SQLite DB</span>
          <span className="font-semibold text-sidebar-foreground">{live?.live?.dbSize ? formatBytes(live.live.dbSize) : "-"}</span>
        </div>
      </div>
    </aside>
  );
}
