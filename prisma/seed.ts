// ============================================
// INVOICER - Database Seed Script
// Usage: bun db:seed
// Reads items from upload/itens.csv
// ============================================

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// ── CSV Parser (handles quoted fields with commas and embedded quotes) ──
function parseCSV(text: string): string[][] {
  const lines: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuote = !inQuote;
    } else if (ch === "\n" && !inQuote) {
      lines.push(current);
      current = "";
    } else if (ch === "\r" && !inQuote) {
      // skip
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  return lines.map((line) => {
    const fields: string[] = [];
    let field = "";
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQ && line[j + 1] === '"') {
          field += '"';
          j++;
          continue;
        }
        inQ = !inQ;
      } else if (c === "," && !inQ) {
        fields.push(field.trim());
        field = "";
      } else {
        field += c;
      }
    }
    fields.push(field.trim());
    return fields;
  });
}

interface CsvItem {
  code: string;
  namePt: string;
  nameEn: string;
  endUse: string;
  sterileAtImport: string;
  unitValueUsd: number;
  grossWeight: number;
  netWeight: number;
}

function loadItemsFromCsv(): CsvItem[] {
  const csvPath = join(process.cwd(), "upload", "itens.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);
  const seen = new Map<string, boolean>();
  const items: CsvItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const code = (r[0] || "").trim();
    if (!code || code.startsWith(";") || seen.has(code)) continue;
    seen.set(code, true);

    const namePt = (r[1] || "").trim();
    if (!namePt) continue;

    const nameEn = (r[2] || "").trim();
    const endUse = (r[3] || "").trim();
    const sterileRaw = (r[4] || "NO").trim().toUpperCase();
    const sterileAtImport = ["YES", "SIM"].includes(sterileRaw) ? "YES" : "NO";
    const unitValueUsd = parseFloat(r[5]) || 0;
    const grossWeight = parseFloat(r[6]) || 0;
    const netWeight = parseFloat(r[7]) || 0;

    items.push({ code, namePt, nameEn, endUse, sterileAtImport, unitValueUsd, grossWeight, netWeight });
  }

  return items;
}

async function main() {
  console.log("[SEED] Starting...");

  // ── Companies ──
  const sender = await prisma.company.create({
    data: {
      name: "Brazil Export Corp.",
      type: "sender",
      contactName: "Carlos Silva",
      address: "Av. Paulista, 1000",
      city: "São Paulo",
      postalCode: "01310-100",
      state: "SP",
      country: "Brazil",
      email: "export@brazilexport.com",
      phone: "+55 11 3000-0001",
      cnpj: "12.345.678/0001-90",
      stateRegistration: "123.456.789.000",
      isDefault: true,
      bankDetails:
        "Bank: Banco do Brasil | SWIFT: BRASBRRJ | Account: 12345-6 | Ag: 0001",
      midCode: "BR-MID-001",
    },
  });
  console.log(`[SEED] Sender: ${sender.name}`);

  const recipient = await prisma.company.create({
    data: {
      name: "Global Medical Imports Inc.",
      type: "recipient",
      contactName: "John Smith",
      address: "123 Medical Drive, Suite 400",
      city: "Miami",
      postalCode: "33101",
      state: "FL",
      country: "United States",
      email: "purchasing@globalmedical.com",
      phone: "+1 305-555-0100",
    },
  });
  console.log(`[SEED] Recipient: ${recipient.name}`);

  // ── Items from CSV ──
  const csvItems = loadItemsFromCsv();
  console.log(`[SEED] Loaded ${csvItems.length} items from CSV`);

  let created = 0;
  for (const item of csvItems) {
    await prisma.item.create({
      data: {
        code: item.code,
        namePt: item.namePt,
        nameEn: item.nameEn,
        unitValueUsd: item.unitValueUsd,
        grossWeight: item.grossWeight,
        netWeight: item.netWeight,
        endUse: item.endUse || null,
        sterileAtImport: item.sterileAtImport,
      },
    });
    created++;
  }

  const zeroPrice = csvItems.filter((i) => i.unitValueUsd === 0).length;
  console.log(`[SEED] Created ${created} items (${zeroPrice} with zero price)`);

  console.log(
    `[SEED] Done! ${await prisma.company.count()} companies, ${await prisma.item.count()} items`,
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[SEED] ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});