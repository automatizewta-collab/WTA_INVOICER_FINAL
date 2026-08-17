import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

export interface AuditLogEntry {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  request?: NextRequest;
}

/**
 * Record an audit log entry. Fire-and-forget — errors are swallowed.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Extract IP from request headers if available
    let ipAddress: string | undefined;
    if (entry.request) {
      const forwarded = entry.request.headers.get("x-forwarded-for");
      ipAddress = forwarded?.split(",")[0]?.trim() ||
        entry.request.headers.get("x-real-ip") ||
        undefined;
    }

    await db.auditLog.create({
      data: {
        userId: entry.userId || null,
        userEmail: entry.userEmail || null,
        action: entry.action,
        entity: entry.entity || null,
        entityId: entry.entityId || null,
        details: entry.details || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch {
    // Audit logging should never break the main flow
  }
}
