import { create } from "zustand";
import type { ViewName } from "./types";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AppState {
  currentView: ViewName;
  editDocumentId: string | null;
  sidebarOpen: boolean;
  user: AuthUser | null;
  navigate: (view: ViewName, id?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "login",
  editDocumentId: null,
  sidebarOpen: true,
  user: null,
  navigate: (view, id) =>
    set({ currentView: view, editDocumentId: id ?? null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null, currentView: "login" }),
}));
