// ============================================
// ERP Import Order - Fetch order data from MSSQL
// Falls back to mock data when MSSQL is not configured
// Auto-registers unmatched items in the catalog
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isErpConfigured, queryErp, parseBrNumber } from "@/lib/mssql";

// ── Mock data based on user's real ERP example (OV 101495) ──
function getMockData(orderNumber: number) {
  return {
    client: {
      name: "Seron & Torregrossa LTDA",
      cnpj: "33.309.876/0001-73",
      email: "financeiro@getagen.com.br",
      address: "Rahme Trad Bechara Hage, 2046 - Higienopolis",
      city: "Sao Jose do Rio Preto",
      state: "SP",
      postalCode: "15025-000",
      country: "BR",
    },
    items: [
      { erpCode: "29920", erpName: "Lacrador 0,25 - Amarelo - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
      { erpCode: "29921", erpName: "Lacrador 0,25 - Verde - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
      { erpCode: "29922", erpName: "Lacrador 0,25 - Roxo - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
      { erpCode: "29923", erpName: "Lacrador 0,25 - Azul - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
      { erpCode: "29926", erpName: "Lacrador 0,25 - Laranja - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
      { erpCode: "29925", erpName: "Lacrador 0,25 - Branco - Pacote (Embal.)", quantity: 5000, grossWeight: 0.03, netWeight: 0.02, nbm: "3923.30.00" },
    ],
    orderNumber,
  };
}

// ── The real query against MSSQL ──
const ERP_QUERY = `
SELECT TOP 100
  A.NUMEROOV,
  B.CGCCPF,
  B.NOME,
  B.EMAIL,
  B.LOGRADOURO,
  B.COMPLEMENTO,
  B.NUMERO,
  B.BAIRRO,
  C.CEP,
  C.NOME AS MUNICIPIO,
  D.SIGLA AS ESTADO,
  F.SIGLA AS PAIS,
  G.CODIGO,
  G.NOME AS PRODUTO_NOME,
  E.QUANTIDADE,
  E.PESOBRUTO,
  E.PESOLIQUIDO,
  H.CODIGONBM
FROM CM_ORDENSVENDA A
LEFT OUTER JOIN GN_PESSOAS B ON B.HANDLE = A.PESSOA
LEFT OUTER JOIN MUNICIPIOS C ON C.HANDLE = B.MUNICIPIO
LEFT OUTER JOIN PAISES F ON F.HANDLE = B.PAIS
LEFT OUTER JOIN ESTADOS D ON D.HANDLE = B.ESTADO
LEFT OUTER JOIN CM_ORDEMVENDAITENS E ON A.HANDLE = E.ORDEMVENDA
LEFT OUTER JOIN PD_PRODUTOS G ON E.PRODUTO = G.HANDLE
LEFT OUTER JOIN TR_TIPIS H ON G.CLASSIFICACAOTIPI = H.HANDLE
WHERE A.NUMEROOV = @orderNumber
ORDER BY A.HANDLE DESC
`;

interface ErpRow {
  NUMEROOV: number;
  CGCCPF: string | null;
  NOME: string;
  EMAIL: string | null;
  LOGRADOURO: string | null;
  COMPLEMENTO: string | null;
  NUMERO: string | null;
  BAIRRO: string | null;
  CEP: string | null;
  MUNICIPIO: string | null;
  ESTADO: string | null;
  PAIS: string | null;
  CODIGO: string;
  PRODUTO_NOME: string;
  QUANTIDADE: number;
  PESOBRUTO: number | string;
  PESOLIQUIDO: number | string;
  CODIGONBM: string | null;
}

function buildAddress(row: ErpRow): string {
  const parts: string[] = [];
  if (row.LOGRADOURO) parts.push(row.LOGRADOURO);
  if (row.NUMERO) parts.push(row.NUMERO);
  if (row.COMPLEMENTO) parts.push(row.COMPLEMENTO);
  if (row.BAIRRO) parts.push(row.BAIRRO);
  return parts.join(", ");
}

function buildClient(rows: ErpRow[]) {
  const r = rows[0];
  const email = r.EMAIL ? r.EMAIL.split(";")[0].trim() : null;
  return {
    name: r.NOME || "",
    cnpj: r.CGCCPF || "",
    email: email || "",
    address: buildAddress(r),
    city: r.MUNICIPIO || "",
    state: r.ESTADO || "",
    postalCode: r.CEP || "",
    country: r.PAIS || "BR",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderNumber = parseInt(body.orderNumber, 10);
    if (!orderNumber || isNaN(orderNumber)) {
      return NextResponse.json({ error: "Order number is required" }, { status: 400 });
    }

    let client: ReturnType<typeof buildClient>;
    let items: Array<{
      erpCode: string;
      erpName: string;
      quantity: number;
      grossWeight: number;
      netWeight: number;
      nbm: string;
    }>;

    // ── Use real MSSQL or mock ──
    if (isErpConfigured()) {
      const rows = await queryErp<ErpRow>(ERP_QUERY, { orderNumber });
      if (!rows || rows.length === 0) {
        return NextResponse.json({ error: `Order ${orderNumber} not found in ERP` }, { status: 404 });
      }
      client = buildClient(rows);
      items = rows.map((r) => ({
        erpCode: String(r.CODIGO),
        erpName: r.PRODUTO_NOME || "",
        quantity: parseBrNumber(r.QUANTIDADE),
        grossWeight: parseBrNumber(r.PESOBRUTO),
        netWeight: parseBrNumber(r.PESOLIQUIDO),
        nbm: r.CODIGONBM || "",
      }));
      console.log(`[ERP] Fetched order ${orderNumber}: ${items.length} items from MSSQL`);
    } else {
      // Mock fallback
      client = getMockData(orderNumber).client;
      items = getMockData(orderNumber).items;
      console.log(`[ERP] Mock data for order ${orderNumber}: ${items.length} items`);
    }

    // ── Match ERP items with Invoicer catalog ──
    const catalogItems = await db.item.findMany();
    const catalogByCode = new Map(catalogItems.map((i) => [i.code, i]));

    // ── Auto-register unmatched items ──
    const autoCreatedCodes: string[] = [];
    for (const item of items) {
      if (!catalogByCode.has(item.erpCode)) {
        await db.item.create({
          data: {
            code: item.erpCode,
            namePt: item.erpName,
            nameEn: "",          // needs attention
            unitValueUsd: 0,
            grossWeight: item.grossWeight,
            netWeight: item.netWeight,
            htsusCode: item.nbm || null,
            endUse: "",
            sterileAtImport: "NO",
          },
        });
        console.log(`[ERP] Auto-registered item ${item.erpCode}: ${item.erpName}`);
        autoCreatedCodes.push(item.erpCode);
      }
    }

    // ── Re-fetch catalog to include newly created items ──
    if (autoCreatedCodes.length > 0) {
      const updatedCatalog = await db.item.findMany();
      const updatedByCode = new Map(updatedCatalog.map((i) => [i.code, i]));
      for (const code of autoCreatedCodes) {
        catalogByCode.set(code, updatedByCode.get(code)!);
      }
    }

    const mappedItems = items.map((item, idx) => {
      const catalog = catalogByCode.get(item.erpCode);
      const wasAutoCreated = autoCreatedCodes.includes(item.erpCode);
      return {
        line_number: idx + 1,
        erpCode: item.erpCode,
        erpName: item.erpName,
        catalogId: catalog?.id || "",
        catalogCode: catalog?.code || item.erpCode,
        namePt: catalog?.namePt || item.erpName,
        matched: !!catalog,
        autoCreated: wasAutoCreated,
        quantity: item.quantity,
        unit_price: catalog?.unitValueUsd || 0,
        discount: 0,
        gross_weight: item.grossWeight,
        net_weight: item.netWeight,
        htsus_code: item.nbm || catalog?.htsusCode || "",
        sterile_at_import: (catalog?.sterileAtImport || "NO") as "YES" | "NO",
        name_en: catalog?.nameEn || "",
        name_es: catalog?.nameEs || "",
        end_use: catalog?.endUse || "",
      };
    });

    // ── Build warnings for items that need attention ──
    const warnings: string[] = [];
    if (autoCreatedCodes.length > 0) {
      warnings.push(
        `${autoCreatedCodes.length} item(ns) auto-cadastrado(s) no catálogo. Preencha o Nome em Inglês na aba Itens.`
      );
    }

    // Check auto-created items for missing English name only
    const itemsNeedingAttention = autoCreatedCodes.map((code) => {
      const catalog = catalogByCode.get(code);
      if (!catalog) return null;
      const missing: string[] = [];
      if (!catalog.nameEn) missing.push("Nome EN");
      return { code, name: catalog.namePt, missing };
    }).filter(Boolean);

    return NextResponse.json({
      orderNumber,
      client,
      items: mappedItems,
      source: isErpConfigured() ? "mssql" : "mock",
      warnings,
      autoCreatedCount: autoCreatedCodes.length,
      itemsNeedingAttention,
    });
  } catch (error) {
    console.error("[ERP] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import order from ERP", details: String(error) },
      { status: 500 },
    );
  }
}