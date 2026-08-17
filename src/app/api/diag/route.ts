import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Diagnostic endpoint — open /api/diag in the browser to check DB state.
 */
export async function GET() {
  const result: Record<string, unknown> = { timestamp: new Date().toISOString() };

  try {
    // 1. Database URL (masked)
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    result.databaseUrl = dbUrl.replace(/:([^@/]+)/, ":***");

    // 2. Table counts
    const companyCount = await db.company.count();
    const itemCount = await db.item.count();
    const documentCount = await db.document.count();
    const userCount = await db.user.count();
    result.counts = { companies: companyCount, items: itemCount, documents: documentCount, users: userCount };

    // 3. List users (email + role — NO password hash)
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    result.users = users;

    // 4. List companies
    const companies = await db.company.findMany({ select: { id: true, name: true, type: true } });
    result.companies = companies;

    // 5. Items count summary
    result.itemsSummary = { total: itemCount };

    // 6. Seed version
    try {
      const seedVersion = await db.appSetting.findUnique({ where: { key: "seed_version" } });
      result.seedVersion = seedVersion?.value || "never run";
    } catch {
      result.seedVersion = "error reading";
    }

    result.status = "ok";
  } catch (error) {
    result.status = "error";
    result.error = String(error);
  }

  return NextResponse.json(result, {
    headers: { "Content-Type": "application/json" },
  });
}
