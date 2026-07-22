import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const companyCount = await db.company.count();
    const itemCount = await db.item.count();

    if (!force && companyCount > 0 && itemCount > 0) {
      return NextResponse.json({
        success: true,
        message: "Database already seeded. Use ?force=true to re-seed.",
        existing: { companies: companyCount, items: itemCount },
      });
    }

    if (force) {
      // Clean in correct order (respect FK constraints)
      await db.document.deleteMany();
      await db.documentSequence.deleteMany();
      await db.item.deleteMany();
      await db.company.deleteMany();
    }

    const sender = await db.company.create({
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
        bankDetails: "Bank: Banco do Brasil | SWIFT: BRASBRRJ | Account: 12345-6 | Ag: 0001",
        midCode: "BR-MID-001",
      },
    });

    const recipient = await db.company.create({
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

    // ── All catalog items ──
    const itemData = [
      // Generic medical items
      { code: "SG-001", namePt: "Luva Cirúrgica Estéril (par)", nameEn: "Surgical Sterile Glove (pair)", nameEs: "Guante Quirúrgico Estéril (par)", unitValueUsd: 0.85, grossWeight: 0.06, netWeight: 0.05, htsusCode: "4015.19.0540", endUse: "Surgical examination gloves for medical procedures", endUseEs: "Guantes de examen quirúrgico para procedimientos médicos", sterileAtImport: "YES" },
      { code: "SY-001", namePt: "Seringa Descartável 5ml", nameEn: "Disposable Syringe 5ml", nameEs: "Jeringa Desechable 5ml", unitValueUsd: 0.12, grossWeight: 0.015, netWeight: 0.012, htsusCode: "9013.31.0040", endUse: "Medical disposable syringe for injections", endUseEs: "Jeringa desechable médica para inyecciones", sterileAtImport: "YES" },
      { code: "MS-001", namePt: "Máscara Cirúrgica Descartável", nameEn: "Disposable Surgical Mask", nameEs: "Mascarilla Quirúrgica Desechable", unitValueUsd: 0.25, grossWeight: 0.01, netWeight: 0.008, htsusCode: "6307.90.9880", endUse: "Surgical face mask for medical environments", endUseEs: "Mascarilla facial quirúrgica para entornos médicos", sterileAtImport: "NO" },
      // Lacrador items (ERP mock — codes match ERP CODIGO)
      { code: "29920", namePt: "Lacrador 0,25 - Amarelo - Pacote (Embal.)", nameEn: "Seal 0.25 - Yellow - Pack (Packaging)", nameEs: "Precinto 0,25 - Amarillo - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
      { code: "29921", namePt: "Lacrador 0,25 - Verde - Pacote (Embal.)", nameEn: "Seal 0.25 - Green - Pack (Packaging)", nameEs: "Precinto 0,25 - Verde - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
      { code: "29922", namePt: "Lacrador 0,25 - Roxo - Pacote (Embal.)", nameEn: "Seal 0.25 - Purple - Pack (Packaging)", nameEs: "Precinto 0,25 - Morado - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
      { code: "29923", namePt: "Lacrador 0,25 - Azul - Pacote (Embal.)", nameEn: "Seal 0.25 - Blue - Pack (Packaging)", nameEs: "Precinto 0,25 - Azul - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
      { code: "29926", namePt: "Lacrador 0,25 - Laranja - Pacote (Embal.)", nameEn: "Seal 0.25 - Orange - Pack (Packaging)", nameEs: "Precinto 0,25 - Naranja - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
      { code: "29925", namePt: "Lacrador 0,25 - Branco - Pacote (Embal.)", nameEn: "Seal 0.25 - White - Pack (Packaging)", nameEs: "Precinto 0,25 - Blanco - Paquete (Embalaje)", unitValueUsd: 0.015, grossWeight: 0.03, netWeight: 0.02, htsusCode: "3923.30.00", endUse: "Plastic bag sealer for packaging", endUseEs: "Precinto de plástico para embalaje", sterileAtImport: "NO" },
    ];

    const items = await Promise.all(
      itemData.map((item) => db.item.create({ data: item }))
    );

    return NextResponse.json({
      success: true,
      message: "Seed completed successfully",
      data: {
        companies: 2,
        items: items.length,
        sender: sender.name,
        recipient: recipient.name,
        catalogItems: { generic: 3, lacrador: 6 },
      },
    });
  } catch (error) {
    console.error("POST /api/seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database", details: String(error) },
      { status: 500 },
    );
  }
}