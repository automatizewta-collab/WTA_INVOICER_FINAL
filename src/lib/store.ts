import { create } from "zustand";
import type { ViewName } from "./types";

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface AppState {
  currentView: ViewName;
  editDocumentId: string | null;
  sidebarOpen: boolean;
  currentUser: CurrentUser | null;
  navigate: (view: ViewName, id?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "login" as ViewName,
  editDocumentId: null,
  sidebarOpen: true,
  currentUser: null,
  navigate: (view, id) =>
    set({ currentView: view, editDocumentId: id ?? null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  logout: () => {
    localStorage.removeItem("invoicer_user");
    set({ currentUser: null, currentView: "login" });
  },
}));

export type { CurrentUser };
