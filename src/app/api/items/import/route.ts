import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/items/import
 * Bulk import items from CSV.
 * Accepts multipart form-data with a "file" field containing a CSV.
 *
 * CSV columns: code, name_pt, name_en, end_use, sterile_at_import, unit_value_usd, gross_weight, net_weight
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const raw = await file.text();

    // Strip BOM and normalize line endings
    const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
    }

    // Parse CSV manually (handles quoted fields with commas)
    function parseCsvLine(line: string): string[] {
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            current += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            fields.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
      }
      fields.push(current.trim());
      return fields;
    }

    // Skip header, parse rows
    const items: { code: string; namePt: string; nameEn: string; endUse: string; sterileAtImport: string; unitValueUsd: number; grossWeight: number; netWeight: number }[] = [];
    const seenCodes = new Set<string>();
    let skipped = 0;
    let parseErrors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = parseCsvLine(lines[i]);
        const code = fields[0];
        const namePt = fields[1] || "";
        const nameEn = fields[2] || "";
        const endUse = fields[3] || "";
        const sterileAtImport = fields[4] || "NO";
        const unitValueUsd = parseFloat(fields[5]) || 0;
        const grossWeight = parseFloat(fields[6]) || 0;
        const netWeight = parseFloat(fields[7]) || 0;

        if (!code) { skipped++; continue; }

        // Deduplicate by code (keep first occurrence)
        if (seenCodes.has(code)) { skipped++; continue; }
        seenCodes.add(code);

        items.push({ code, namePt, nameEn, endUse, sterileAtImport, unitValueUsd, grossWeight, netWeight });
      } catch {
        parseErrors++;
      }
    }

    // Upsert: skip existing codes, insert new ones in batches of 50
    const BATCH_SIZE = 50;
    let inserted = 0;
    let updated = 0;
    let existing = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      // Check which codes already exist
      const existingCodes = new Set(
        (await db.item.findMany({
          where: { code: { in: batch.map((b) => b.code) } },
          select: { code: true },
        })).map((e) => e.code),
      );

      const newItems = batch.filter((b) => !existingCodes.has(b.code));
      const oldItems = batch.filter((b) => existingCodes.has(b.code));

      existing += oldItems.length;

      if (newItems.length > 0) {
        await db.item.createMany({ data: newItems });
        inserted += newItems.length;
      }

      // Update existing items with latest data
      if (oldItems.length > 0) {
        await Promise.all(
          oldItems.map((b) =>
            db.item.updateMany({
              where: { code: b.code },
              data: {
                namePt: b.namePt,
                nameEn: b.nameEn,
                endUse: b.endUse,
                unitValueUsd: b.unitValueUsd,
                grossWeight: b.grossWeight,
                netWeight: b.netWeight,
              },
            }),
          ),
        );
        updated += oldItems.length;
      }
    }

    return NextResponse.json({
      success: true,
      parsed: items.length,
      inserted,
      updated,
      existing,
      skipped,
      parseErrors,
    });
  } catch (error) {
    return NextResponse.json({ error: "Import failed", details: String(error) }, { status: 500 });
  }
}
