import { create } from "zustand";
import type { ViewName } from "./types";

interface AppState {
  currentView: ViewName;
  editDocumentId: string | null;
  sidebarOpen: boolean;
  navigate: (view: ViewName, id?: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: "dashboard",
  editDocumentId: null,
  sidebarOpen: true,
  navigate: (view, id) =>
    set({ currentView: view, editDocumentId: id ?? null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));