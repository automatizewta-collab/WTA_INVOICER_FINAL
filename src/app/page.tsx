"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, LayoutDashboard, Package, PlusCircle, Building2, Settings, LogOut, Users } from "lucide-react";
import { LoginPage } from "@/components/views/LoginView";
import { DashboardView } from "@/components/views/DashboardView";
import { DocumentsView } from "@/components/views/DocumentsView";
import { NewDocumentView } from "@/components/views/NewDocumentView";
import { EditDocumentView } from "@/components/views/EditDocumentView";
import { ItemsView } from "@/components/views/ItemsView";
import { CompaniesView } from "@/components/views/CompaniesView";
import { SettingsView } from "@/components/views/SettingsView";
import { UsersView } from "@/components/views/UsersView";
import type { ViewName, UserRole } from "@/lib/types";
import { toast } from "sonner";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  logistica: "Logística",
  comercial: "Comercial",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "default",
  logistica: "secondary",
  comercial: "outline",
};

const navItems: { view: ViewName; label: string; icon: typeof FileText; adminOnly?: boolean }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "documents", label: "Documents", icon: FileText },
  { view: "new-document", label: "New Document", icon: PlusCircle },
  { view: "items", label: "Items", icon: Package },
  { view: "companies", label: "Companies", icon: Building2 },
  { view: "users", label: "Usuários", icon: Users, adminOnly: true },
  { view: "settings", label: "Settings", icon: Settings, adminOnly: true },
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
    case "users":
      return <UsersView />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

function AppSidebar() {
  const currentView = useAppStore((s) => s.currentView);
  const navigate = useAppStore((s) => s.navigate);
  const userRole = useAppStore((s) => s.userRole);

  const filteredNav = navItems.filter(
    (item) => !item.adminOnly || userRole === "admin",
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <FileText className="h-5 w-5 shrink-0" />
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
              {filteredNav.map((item) => (
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
          {userRole && (
            <div className="flex items-center justify-between">
              <Badge variant={ROLE_COLORS[userRole] as "default" | "secondary" | "outline"}>
                {ROLE_LABELS[userRole]}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={async () => {
                  await signOut({ redirect: false });
                  useAppStore.getState().clearAuth();
                  toast.info("Sessão encerrada");
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Invoicer v2.0.0
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

export default function HomePage() {
  const { data: session, status } = useSession();
  const setAuth = useAppStore((s) => s.setAuth);
  const currentView = useAppStore((s) => s.currentView);
  const clearAuth = useAppStore((s) => s.clearAuth);

  // Sync session → store
  useEffect(() => {
    if (session?.user) {
      const u = session.user as unknown as { role?: string; id?: string; name?: string | null };
      if (u.role && u.id) {
        setAuth(u.role as UserRole, u.id, u.name || null);
      }
    }
  }, [session, setAuth]);

  // If not logged in, show login page only
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session || currentView === "login") {
    return <LoginPage />;
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
            Invoicer — Sistema de Gestão de Documentos Comerciais
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
