import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Type-safe fetch helper that throws on non-OK responses.
 * Use this in all useQuery/mutation queryFn to prevent silent errors.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    const error = body as Record<string, string>;
    const msg = error.error || `HTTP ${res.status}`;
    const details = error.details ? ` | ${error.details}` : "";
    throw new Error(msg + details);
  }
  return res.json() as Promise<T>;
}

/**
 * Safely parse a JSON field that may be a native object (MySQL) or a JSON string (SQLite).
 */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}
