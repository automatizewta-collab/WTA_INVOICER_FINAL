import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

/**
 * Auto-init endpoint — called by the frontend on first load after login.
 * Ensures exactly one admin user exists and marks seed as complete.
 * This handles cases where Docker seed didn't fully run or DB was migrated.
 */
export async function POST() {
  try {
    const results: Record<string, unknown> = {};

    // 1. Ensure exactly one admin user
    const deletedCount = await db.user.deleteMany({
      where: { email: { not: "admin@invoicer.com" } },
    });
    if (deletedCount.count > 0) {
      results.deletedUsers = deletedCount.count;
    }

    const passwordHash = await hash("admin123", 10);
    const admin = await db.user.upsert({
      where: { email: "admin@invoicer.com" },
      update: { passwordHash, role: "admin", name: "Admin" },
      create: { email: "admin@invoicer.com", name: "Admin", role: "admin", passwordHash },
    });
    results.admin = { id: admin.id, email: admin.email, role: admin.role };

    // 2. Mark seed as complete (fixes "seedVersion": "never run")
    await db.appSetting.upsert({
      where: { key: "seed_version" },
      update: { value: "1" },
      create: { key: "seed_version", value: "1" },
    });
    results.seedVersion = "1";

    // 3. Report counts
    const counts = {
      users: await db.user.count(),
      companies: await db.company.count(),
      items: await db.item.count(),
      documents: await db.document.count(),
    };
    results.counts = counts;

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
