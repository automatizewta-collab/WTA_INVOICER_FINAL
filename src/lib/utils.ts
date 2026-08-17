import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse a value that may be a JSON string or already a parsed object.
 * Needed because Prisma returns `String` fields as strings (SQLite)
 * but `Json` fields as already-parsed objects (MySQL).
 */
export function safeJsonParse(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value; // already parsed (MySQL Json)
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
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
