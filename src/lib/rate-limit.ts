/**
 * Simple in-memory rate limiter.
 * Tracks attempts per key (e.g. email or IP).
 * Cleans up expired entries periodically.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes to prevent memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now >= entry.resetAt) store.delete(key);
      }
    }, 5 * 60 * 1000);
    // Allow the process to exit without waiting for this timer
    if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
      cleanupTimer.unref();
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a key.
 * @param key - Identifier (e.g. email for login, IP for API)
 * @param maxAttempts - Max allowed attempts in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    // New window
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: maxAttempts - 1, resetAt };
  }

  if (existing.count >= maxAttempts) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return {
    success: true,
    remaining: maxAttempts - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Reset rate limit for a key (e.g. after successful login).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
