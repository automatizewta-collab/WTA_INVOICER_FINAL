"use client";

import { SessionProvider } from "next-auth/react";
import { QueryProvider } from "@/providers/query-provider";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <QueryProvider>{children}</QueryProvider>
    </SessionProvider>
  );
}
