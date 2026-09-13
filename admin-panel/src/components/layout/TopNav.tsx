import React, { useState } from "react";
import { Zap, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface TopNavProps {
  title: string;
}

export function TopNav({ title }: TopNavProps) {
  const [healing, setHealing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const handleHealKiro = async () => {
    try {
      setHealing(true);
      const res = await api.healAllKiro();
      toast.success(res.message || `Healed ${res.healedCount} Kiro accounts`);
    } catch (err: any) {
      toast.error(err.message || "Failed to heal Kiro keys");
    } finally {
      setHealing(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      const res = await api.createBackup();
      toast.success(`SQLite snapshot created: ${res.backup?.filename || "Success"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create database snapshot");
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm px-6 flex items-center justify-between font-sans">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium">Console</span>
        <span className="text-muted-foreground/40 font-mono">/</span>
        <span className="font-semibold text-foreground tracking-tight">{title}</span>
      </div>

      {/* Global Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleHealKiro}
          disabled={healing}
          className="gap-1.5 text-xs font-semibold h-8 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          title="Reset and heal error state on all Kiro keys"
        >
          <Zap className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
          {healing ? "Healing..." : "Heal Kiro Keys"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleBackup}
          disabled={backingUp}
          className="gap-1.5 text-xs font-semibold h-8"
          title="Create an on-demand SQLite snapshot backup"
        >
          <Database className="w-3.5 h-3.5 text-primary" />
          {backingUp ? "Backing up..." : "Backup SQLite"}
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <ThemeToggle />
      </div>
    </header>
  );
}
