import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-api";

export async function GET(request: NextRequest) {
  const user = await requireRole("admin");
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const entity = searchParams.get("entity");
    const userId = searchParams.get("userId");

    const where: Record<string, unknown> = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;

    const logs = await db.auditLog.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      take: Math.min(limit, 500),
      orderBy: { createdAt: "desc" },
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({ logs, total });
  } catch {
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
