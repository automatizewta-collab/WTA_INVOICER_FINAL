import { create } from "zustand";
import type { ViewName, UserRole } from "./types";

interface AppState {
  currentView: ViewName;
  editDocumentId: string | null;
  sidebarOpen: boolean;
  userRole: UserRole | null;
  userId: string | null;
  userName: string | null;
  navigate: (view: ViewName, id?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setAuth: (role: UserRole, id: string, name: string | null) => void;
  clearAuth: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "login",
  editDocumentId: null,
  sidebarOpen: true,
  userRole: null,
  userId: null,
  userName: null,
  navigate: (view, id) =>
    set({ currentView: view, editDocumentId: id ?? null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setAuth: (role, id, name) => set({ userRole: role, userId: id, userName: name }),
  clearAuth: () => set({ userRole: null, userId: null, userName: null, currentView: "login" }),
}));
