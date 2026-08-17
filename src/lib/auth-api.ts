import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  };
}

const NO_AUTH_ROUTES = new Set([
  "/api/auth",
  "/api/health",
  "/api/seed",
]);

/**
 * Get the authenticated user session from the request.
 * Returns null if not authenticated (caller should return 401).
 */
export async function getAuthSession(): Promise<AuthSession["user"] | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    return {
      id: (session.user as unknown as { id: string }).id,
      email: session.user.email || "",
      name: session.user.name,
      role: (session.user as unknown as { role: string }).role || "logistica",
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns user or a 401 response.
 * Usage: const user = await requireAuth(); if (!user) return user; // 401
 */
export async function requireAuth(): Promise<AuthSession["user"] | NextResponse> {
  const user = await getAuthSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Require a specific role. Returns user or a 403 response.
 */
export async function requireRole(
  ...roles: string[]
): Promise<AuthSession["user"] | NextResponse> {
  const user = await requireAuth();
  if (user instanceof NextResponse) return user; // 401
  if (!roles.includes(user.role || "")) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 }
    );
  }
  return user;
}

/**
 * Check if a path should be protected.
 */
export function isProtectedRoute(pathname: string): boolean {
  if (NO_AUTH_ROUTES.has(pathname)) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  return true;
}
