// ============================================
// INVOICER - Database Seed Script
// Usage: bun db:seed
// Reads items from upload/itens.csv
// Idempotent: skips if data already exists
// ============================================

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// -- CSV Parser (handles quoted fields with commas and embedded quotes) --
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
      // skip CR
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  return lines.map(function (line) {
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
  const possiblePaths = [
    join(process.cwd(), "upload", "itens.csv"),
    "/app/upload/itens.csv",
    "/app/data/itens.csv",
    join(process.cwd(), "data", "itens.csv"),
  ];

  let csvPath: string | null = null;
  for (let k = 0; k < possiblePaths.length; k++) {
    if (existsSync(possiblePaths[k])) {
      csvPath = possiblePaths[k];
      break;
    }
  }

  if (!csvPath) {
    console.log("[SEED] WARNING: itens.csv not found in any expected path:");
    for (let w = 0; w < possiblePaths.length; w++) {
      console.log("  - " + possiblePaths[w]);
    }
    return [];
  }

  console.log("[SEED] Found CSV at: " + csvPath);
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

    items.push({ code: code, namePt: namePt, nameEn: nameEn, endUse: endUse, sterileAtImport: sterileAtImport, unitValueUsd: unitValueUsd, grossWeight: grossWeight, netWeight: netWeight });
  }

  return items;
}

async function main() {
  console.log("[SEED] Starting...");

  const dbUrl = process.env.DATABASE_URL || "";
  console.log("[SEED] Database: " + dbUrl.substring(0, 40) + "...");

  // -- Check if seed already ran (idempotent) --
  const existingItems = await prisma.item.count();
  const existingCompanies = await prisma.company.count();
  const existingUsers = await prisma.user.count();
  console.log("[SEED] Current state: " + existingCompanies + " companies, " + existingItems + " items, " + existingUsers + " users");

  // -- Users (only if none exist) --
  if (existingUsers === 0) {
    console.log("[SEED] Creating default users...");

    const adminHash = await hash("admin123", 10);
    const logisticaHash = await hash("logistica123", 10);
    const comercialHash = await hash("comercial123", 10);

    await prisma.user.createMany({
      data: [
        { email: "admin@invoicer.com", name: "Administrador", role: "admin", passwordHash: adminHash },
        { email: "logistica@invoicer.com", name: "Logística", role: "logistica", passwordHash: logisticaHash },
        { email: "comercial@invoicer.com", name: "Comercial", role: "comercial", passwordHash: comercialHash },
      ],
      skipDuplicates: true,
    });
    console.log("[SEED] Created 3 default users (admin, logistica, comercial).");
  } else {
    console.log("[SEED] " + existingUsers + " users already exist, skipping user seed.");
  }

  // -- Companies (only if none exist) --
  if (existingCompanies === 0) {
    console.log("[SEED] Creating default companies...");

    const sender = await prisma.company.create({
      data: {
        name: "Brazil Export Corp.",
        type: "sender",
        contactName: "Carlos Silva",
        address: "Av. Paulista, 1000",
        city: "Sao Paulo",
        postalCode: "01310-100",
        state: "SP",
        country: "Brazil",
        email: "export@brazilexport.com",
        phone: "+55 11 3000-0001",
        cnpj: "12.345.678/0001-90",
        stateRegistration: "123.456.789.000",
        isDefault: true,
        bankDetails: "Bank: Banco do Brasil | SWIFT: BRASBRRJ | Account: 12345-6 | Ag: 0001",
        midCode: "BR-MID-001",
      },
    });
    console.log("[SEED] Created sender: " + sender.name);

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
    console.log("[SEED] Created recipient: " + recipient.name);
  } else {
    console.log("[SEED] Companies already exist, skipping.");
  }

  // -- Items from CSV (only if none exist) --
  if (existingItems === 0) {
    const csvItems = loadItemsFromCsv();
    if (csvItems.length === 0) {
      console.log("[SEED] No CSV items loaded. Skipping item seed.");
    } else {
      console.log("[SEED] Loaded " + csvItems.length + " items from CSV, inserting...");

      const BATCH_SIZE = 50;
      let created = 0;

      for (let i = 0; i < csvItems.length; i += BATCH_SIZE) {
        const batch = csvItems.slice(i, i + BATCH_SIZE);
        await prisma.item.createMany({
          data: batch.map(function (item) {
            return {
              code: item.code,
              namePt: item.namePt,
              nameEn: item.nameEn,
              unitValueUsd: item.unitValueUsd,
              grossWeight: item.grossWeight,
              netWeight: item.netWeight,
              endUse: item.endUse || null,
              sterileAtImport: item.sterileAtImport,
            };
          }),
          skipDuplicates: true,
        });
        created += batch.length;
        console.log("[SEED] Inserted " + created + "/" + csvItems.length + " items...");
      }
      console.log("[SEED] Done! " + created + " items inserted.");
    }
  } else {
    console.log("[SEED] " + existingItems + " items already exist, skipping item seed.");
  }

  // -- Mark seed as complete --
  await prisma.appSetting.upsert({
    where: { key: "seed_version" },
    update: { value: "1" },
    create: { key: "seed_version", value: "1" },
  });

  const totalCompanies = await prisma.company.count();
  const totalItems = await prisma.item.count();
  const totalUsers = await prisma.user.count();
  console.log("[SEED] Complete! " + totalUsers + " users, " + totalCompanies + " companies, " + totalItems + " items in database.");
  await prisma.$disconnect();
}

main().catch(async function (e) {
  console.error("[SEED] ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
