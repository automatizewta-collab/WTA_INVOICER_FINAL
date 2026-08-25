"use client";

import { useAppStore } from "@/lib/store";
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
import { LoginPage } from "@/components/views/LoginView";
import { DashboardView } from "@/components/views/DashboardView";
import { DocumentsView } from "@/components/views/DocumentsView";
import { NewDocumentView } from "@/components/views/NewDocumentView";
import { EditDocumentView } from "@/components/views/EditDocumentView";
import { ItemsView } from "@/components/views/ItemsView";
import { CompaniesView } from "@/components/views/CompaniesView";
import { SettingsView } from "@/components/views/SettingsView";
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
    case "login":
      return <LoginPage />;
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
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/logos/wta-logo.png" alt="WTA" className="h-5 w-5 shrink-0" />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Invoicer
          </span>
        </div>
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
        <div className="px-4 py-2 space-y-2">
          {user && (
            <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <p className="font-medium text-foreground truncate">{user.name || user.email}</p>
              <p className="capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full group-data-[collapsible=icon]:justify-center"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
          </button>
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

export default function HomePage() {
  const currentView = useAppStore((s) => s.currentView);
  const isLogin = currentView === "login";

  if (isLogin) {
    return <ViewRouter />;
  }

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
