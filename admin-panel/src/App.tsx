import { useState, useEffect } from "react";
import { AppSidebar, AdminRoute } from "@/components/layout/AppSidebar";
import { TopNav } from "@/components/layout/TopNav";
import { useLiveStat } from "@/hooks/use-live-stat";
import { DashboardView } from "@/views/admin/DashboardView";
import { AccountsView } from "@/views/admin/AccountsView";
import { ProvidersView } from "@/views/admin/ProvidersView";
import { ProxiesView } from "@/views/admin/ProxiesView";
import { ModelsView } from "@/views/admin/ModelsView";
import { CustomModelsView } from "@/views/admin/CustomModelsView";
import { MembersView } from "@/views/admin/MembersView";
import { QuotasView } from "@/views/admin/QuotasView";
import { PricingView } from "@/views/admin/PricingView";
import { ErrorsView } from "@/views/admin/ErrorsView";
import { SettingsView } from "@/views/admin/SettingsView";
import { DocsView } from "@/views/docs/DocsView";
import { StatusView } from "@/views/status/StatusView";
import { MemberLogin } from "@/views/member/MemberLogin";
import { MemberDashboard } from "@/views/member/MemberDashboard";

export function App() {
  const [route, setRoute] = useState<AdminRoute>("dashboard");
  const { live } = useLiveStat(3500);

  const cleanPath = window.location.pathname.replace(/\/+$/, "");

  // Documentation standalone URL
  const isDocsPath = cleanPath === "/docs" || cleanPath === "/docs.html" || window.location.pathname.startsWith("/docs/");
  if (isDocsPath) {
    return (
      <div className="min-h-screen w-full bg-background p-6">
        <DocsView isStandalone={true} />
      </div>
    );
  }

  // System Status standalone URL
  const isStatusPath = cleanPath === "/status" || cleanPath === "/status.html" || window.location.pathname.startsWith("/status/");
  if (isStatusPath) {
    return (
      <div className="min-h-screen w-full bg-background p-6">
        <StatusView isStandalone={true} />
      </div>
    );
  }

  // Member Portal state
  const isMemberPath = cleanPath === "/member" || cleanPath === "/member.html" || window.location.pathname.startsWith("/member/");
  const [memberToken, setMemberToken] = useState<string | null>(
    () => localStorage.getItem("9router_member_token")
  );
  const [memberData, setMemberData] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("9router_member_data") || "null");
    } catch {
      return null;
    }
  });

  const handleMemberLogin = (token: string, member: any) => {
    setMemberToken(token);
    setMemberData(member);
    localStorage.setItem("9router_member_token", token);
    localStorage.setItem("9router_member_data", JSON.stringify(member));
  };

  const handleMemberLogout = () => {
    setMemberToken(null);
    setMemberData(null);
    localStorage.removeItem("9router_member_token");
    localStorage.removeItem("9router_member_data");
  };

  if (isMemberPath) {
    if (!memberToken || !memberData) {
      return <MemberLogin onLoginSuccess={handleMemberLogin} />;
    }
    return (
      <MemberDashboard
        token={memberToken}
        member={memberData}
        onLogout={handleMemberLogout}
      />
    );
  }

  const renderAdminView = () => {
    switch (route) {
      case "dashboard":
        return <DashboardView />;
      case "accounts":
        return <AccountsView />;
      case "providers":
        return <ProvidersView />;
      case "proxies":
        return <ProxiesView />;
      case "models":
        return <ModelsView />;
      case "custom":
        return <CustomModelsView />;
      case "members":
        return <MembersView />;
      case "quotas":
        return <QuotasView />;
      case "pricing":
        return <PricingView />;
      case "errors":
        return <ErrorsView />;
      case "settings":
        return <SettingsView />;
      case "docs":
        return <DocsView initialApiKey="" isStandalone={false} />;
      default:
        return <DashboardView />;
    }
  };

  const getPageTitle = () => {
    switch (route) {
      case "dashboard": return "Live Usage & Analytics Spectrum";
      case "accounts": return "Provider Key Management";
      case "providers": return "Upstream Provider Nodes";
      case "proxies": return "Egress Proxy Pools";
      case "models": return "Allowed Models Catalog";
      case "custom": return "Custom Model Mappings";
      case "members": return "Members & API Keys";
      case "quotas": return "Token Quotas & Caps";
      case "pricing": return "Token Pricing Matrix";
      case "errors": return "Upstream Error Stream";
      case "settings": return "System Settings & SQLite Backup";
      case "docs": return "API Documentation & Developer Quickstart";
      default: return "Dashboard";
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar
        currentRoute={route}
        onRouteChange={setRoute}
        live={live}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopNav title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
          {renderAdminView()}
        </main>
      </div>
    </div>
  );
}

export default App;
