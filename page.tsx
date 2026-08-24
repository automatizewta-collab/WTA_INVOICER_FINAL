"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { CurrentUser } from "@/lib/store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { FileText, LayoutDashboard, Package, PlusCircle, Building2, Settings, LogOut } from "lucide-react";
import { apiFetch } from "@/lib/utils";
import { LoginPage } from "@/components/views/LoginView";
import { DashboardView } from "@/components/views/DashboardView";
import { DocumentsView } from "@/components/views/DocumentsView";
import { NewDocumentView } from "@/components/views/NewDocumentView";
import { EditDocumentView } from "@/components/views/EditDocumentView";
import { ItemsView } from "@/components/views/ItemsView";
import { CompaniesView } from "@/components/views/CompaniesView";
import { SettingsView } from "@/components/views/SettingsView";
import { Button } from "@/components/ui/button";
import type { ViewName } from "@/lib/types";

const navItems: { view: ViewName; label: string; icon: typeof FileText }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "documents", label: "Documents", icon: FileText },
  { view: "new-document", label: "New Document", icon: PlusCircle },
  { view: "items", label: "Items", icon: Package },
  { view: "companies", label: "Companies", icon: Building2 },
  { view: "settings", label: "Settings", icon: Settings },
];

function ViewRouter() {
  const currentView = useAppStore((s) => s.currentView);

  switch (currentView) {
    case "dashboard":
      return <DashboardView />;
    case "documents":
      return <DocumentsView />;
    case "new-document":
      return <NewDocumentView />;
    case "edit-document":
      return <EditDocumentView />;
    case "items":
      return <ItemsView />;
    case "companies":
      return <CompaniesView />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

function AppSidebar() {
  const currentView = useAppStore((s) => s.currentView);
  const navigate = useAppStore((s) => s.navigate);
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);
  const [senderLogo, setSenderLogo] = useState("");

  useEffect(() => {
    // Try to load the hardcoded logo
    const img = new Image();
    img.onload = () => setSenderLogo("/logos/wta-logo-hd.png");
    img.onerror = () => {
      // Fallback: try fetching from companies API
      if (!currentUser) return;
      apiFetch<{ items: Array<{ id: string; type: string; isDefault: boolean; logoUrl: string | null }> }>("/api/companies?type=all")
        .then((data) => {
          const items = data?.items ?? data ?? [];
          const def = items.find((c) => c.type === "sender" && c.isDefault);
          if (def?.logoUrl) setSenderLogo(def.logoUrl);
        })
        .catch(() => {});
    };
    img.src = "/logos/wta-logo-hd.png";
  }, [currentUser]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <button
          type="button"
          onClick={() => navigate("documents")}
          className="flex items-center gap-2 px-2 py-1 w-full text-left hover:bg-accent rounded-md cursor-pointer transition-colors"
        >
          {senderLogo ? (
            <img src={senderLogo} alt="Logo" className="h-5 w-5 shrink-0 object-contain rounded" />
          ) : (
            <FileText className="h-5 w-5 shrink-0" />
          )}
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Invoicer
          </span>
        </button>
        <Separator className="mx-2" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    isActive={currentView === item.view}
                    onClick={() => navigate(item.view)}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {currentUser && (
          <div className="flex items-center justify-between px-4 py-2 border-t mb-1">
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-xs font-medium truncate">{currentUser.name || currentUser.email}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={logout}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Invoicer v1.0.0
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppHeader() {
  const currentView = useAppStore((s) => s.currentView);
  const label =
    navItems.find((item) => item.view === currentView)?.label || "Invoicer";

  return (
    <header className="flex h-12 items-center gap-2 border-b px-4 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </header>
  );
}

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <ViewRouter />
        </main>
        <footer className="border-t px-4 py-3 mt-auto">
          <p className="text-xs text-muted-foreground text-center">
            Invoicer — Commercial Document Management System
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}

function isValidUser(u: unknown): u is CurrentUser {
  return (
    typeof u === "object" &&
    u !== null &&
    typeof (u as Record<string, unknown>).id === "string" &&
    typeof (u as Record<string, unknown>).email === "string" &&
    typeof (u as Record<string, unknown>).role === "string"
  );
}

export default function HomePage() {
  const currentView = useAppStore((s) => s.currentView);
  const currentUser = useAppStore((s) => s.currentUser);

  // Restore session from localStorage on mount (with validation)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("invoicer_user");
      if (saved) {
        const user: unknown = JSON.parse(saved);
        if (isValidUser(user)) {
          useAppStore.setState({ currentUser: user, currentView: "dashboard" });
          // Ensure DB state is correct on restore
          fetch("/api/init", { method: "POST" }).catch(() => {});
        } else {
          localStorage.removeItem("invoicer_user");
        }
      }
    } catch {
      localStorage.removeItem("invoicer_user");
    }
  }, []);

  // Always show login if no authenticated user
  if (!currentUser || currentView === "login") {
    return <LoginPage />;
  }

  return <AppLayout />;
}