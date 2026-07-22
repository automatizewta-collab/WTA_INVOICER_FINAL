import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Diagnostic endpoint — open /api/diag in the browser to check DB state.
 * Temporary: remove in production.
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

    // 3. List companies
    const companies = await db.company.findMany({ select: { id: true, name: true, type: true } });
    result.companies = companies;

    // 4. List items (code + name only)
    const items = await db.item.findMany({ select: { id: true, code: true, nameEn: true } });
    result.items = items;

    // 5. Test: try inserting and rolling back a company via Prisma (DB-agnostic)
    try {
      const testId = "diag_test_" + Date.now();
      await db.company.create({
        data: { id: testId, name: "__diag_test__", type: "sender" },
      });
      await db.company.delete({ where: { id: testId } });
      result.companyInsertTest = "OK — companies table accepts inserts";
    } catch (e: unknown) {
      result.companyInsertTest = `FAILED — ${String(e)}`;
    }

    // 6. Check provider
    result.provider = process.env.DATABASE_URL?.startsWith("file:") ? "SQLite" : "MySQL";

    result.status = "ok";
  } catch (error) {
    result.status = "error";
    result.error = String(error);
  }

  return NextResponse.json(result, {
    headers: { "Content-Type": "application/json" },
  });
}