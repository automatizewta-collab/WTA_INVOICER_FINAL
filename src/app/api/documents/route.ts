import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, format, parseISO } from "date-fns";
import { z } from "zod";

const documentCreateSchema = z.object({
  documentType: z.enum(["proforma", "invoice", "packing_list"]),
  status: z.enum(["draft", "issued"]).optional().default("draft"),
  language: z.enum(["en", "es"]).optional().default("en"),
  date: z.string().optional(),
  senderId: z.string().min(1),
  recipientId: z.string().optional().nullable(),
  items: z.array(z.any()).optional().default([]),
  dollarExchangeRate: z.number().optional().nullable(),
  currency: z.enum(["USD", "EUR"]).optional().default("USD"),
  htsusColumnTitle: z.string().optional().nullable(),
  showSterileColumn: z.boolean().optional().default(false),
  showEndUseColumn: z.boolean().optional().default(false),
  shipmentDetails: z.any().optional().nullable(),
  financialDetails: z.any().optional().nullable(),
  notes: z.array(z.string()).optional().default([]),
  contactName: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  orderNumber: z.string().optional().nullable(),
  // If provided, used as document number (ERP import)
  customNumber: z.string().optional(),
});

function serializeDocument(doc: Record<string, unknown>) {
  return {
    id: doc.id,
    documentType: doc.documentType,
    status: doc.status,
    language: doc.language,
    number: doc.number,
    date: new Date(doc.date as string).toISOString(),
    senderId: doc.senderId,
    recipientId: doc.recipientId,
    items: JSON.parse(doc.items as string),
    dollarExchangeRate: doc.dollarExchangeRate,
    currency: doc.currency,
    htsusColumnTitle: doc.htsusColumnTitle,
    showSterileColumn: doc.showSterileColumn,
    showEndUseColumn: doc.showEndUseColumn,
    originProformaId: doc.originProformaId,
    contactName: doc.contactName,
    contactPhone: doc.contactPhone,
    orderNumber: doc.orderNumber,
    shipmentDetails: doc.shipmentDetails ? JSON.parse(doc.shipmentDetails as string) : null,
    financialDetails: doc.financialDetails ? JSON.parse(doc.financialDetails as string) : null,
    notes: doc.notes ? JSON.parse(doc.notes as string) : [],
    pdfUrl: doc.pdfUrl,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
    sender: (doc.sender as Record<string, unknown>) ? {
      id: (doc.sender as Record<string, unknown>).id,
      name: (doc.sender as Record<string, unknown>).name,
      type: (doc.sender as Record<string, unknown>).type,
      city: (doc.sender as Record<string, unknown>).city,
      country: (doc.sender as Record<string, unknown>).country,
    } : null,
    recipient: (doc.recipient as Record<string, unknown>) ? {
      id: (doc.recipient as Record<string, unknown>).id,
      name: (doc.recipient as Record<string, unknown>).name,
      type: (doc.recipient as Record<string, unknown>).type,
      city: (doc.recipient as Record<string, unknown>).city,
      country: (doc.recipient as Record<string, unknown>).country,
    } : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: Record<string, unknown> = {};
    if (type && type !== "all") where.documentType = type;
    if (status && status !== "all") where.status = status;
    if (search) where.number = { contains: search };

    const documents = await db.document.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { sender: true, recipient: true },
    });

    const total = await db.document.count({ where });
    const draftsCount = await db.document.count({ where: { status: "draft" } });
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const thisMonthCount = await db.document.count({
      where: { createdAt: { gte: parseISO(monthStart) } },
    });

    const issuedDocs = await db.document.findMany({
      where: { status: "issued", documentType: { in: ["proforma", "invoice"] } },
      select: { financialDetails: true },
    });
    const totalValue = issuedDocs.reduce((sum, doc) => {
      try {
        const fd = JSON.parse(doc.financialDetails);
        return sum + (fd.total_value || 0);
      } catch { return sum; }
    }, 0);

    return NextResponse.json({
      documents: documents.map((d) => serializeDocument(d as unknown as Record<string, unknown>)),
      counts: { total, drafts: draftsCount, thisMonth: thisMonthCount, totalValue },
    });
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = documentCreateSchema.parse(body);

    // Generate number: use custom (OV number) or auto-generate
    let number: string;
    if (data.customNumber) {
      number = String(data.customNumber);
      // Check for uniqueness
      const existing = await db.document.findUnique({ where: { number } });
      if (existing) {
        return NextResponse.json(
          { error: `Document with number "${number}" already exists` },
          { status: 409 },
        );
      }
      console.log(`[DOC] Using custom number: ${number}`);
    } else {
      const yearMonth = format(new Date(), "yyMM");
      const sequence = await db.documentSequence.upsert({
        where: { yearMonth },
        create: { yearMonth, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      number = `${yearMonth}${String(sequence.lastNumber).padStart(6, "0")}`;
    }

    const itemsJson = JSON.stringify(data.items || []);
    const shipmentJson = data.shipmentDetails ? JSON.stringify(data.shipmentDetails) : null;
    const notesJson = JSON.stringify(data.notes || []);
    const docDate = new Date(data.date || new Date().toISOString());

    const baseData = {
      date: docDate,
      senderId: data.senderId,
      recipientId: data.recipientId || null,
      items: itemsJson,
      dollarExchangeRate: data.dollarExchangeRate,
      currency: data.currency,
      htsusColumnTitle: data.htsusColumnTitle,
      showSterileColumn: data.showSterileColumn,
      showEndUseColumn: data.showEndUseColumn,
      shipmentDetails: shipmentJson,
      notes: notesJson,
      contactName: data.contactName || null,
      contactPhone: data.contactPhone || null,
      orderNumber: data.orderNumber || null,
      language: data.language,
    };

    let results: unknown[] = [];

    // ── Draft: create single document only (no cascade) ──
    if (data.status === "draft") {
      const docFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;
      const doc = await db.document.create({
        data: {
          ...baseData,
          number,
          documentType: data.documentType,
          status: "draft",
          financialDetails: docFinancial,
        },
        include: { sender: true, recipient: true },
      });
      results = [serializeDocument(doc as unknown as Record<string, unknown>)];

    } else if (data.documentType === "proforma") {
      // CASCADE: Create Proforma + Invoice + Packing List
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });
      const invFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;

      const [proforma, invoice, packingList] = await db.$transaction([
        db.document.create({
          data: {
            ...baseData,
            number,
            documentType: "proforma",
            status: data.status,
            financialDetails: invFinancial,
          },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: {
            ...baseData,
            number: `${number}-INV`,
            documentType: "invoice",
            status: data.status,
            financialDetails: invFinancial,
          },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: {
            ...baseData,
            number: `${number}-PL`,
            documentType: "packing_list",
            status: data.status,
            financialDetails: plFinancial,
            originProformaId: undefined,
          },
          include: { sender: true, recipient: true },
        }),
      ]);

      // Set origin links
      await db.document.update({
        where: { id: invoice.id },
        data: { originProformaId: proforma.id },
      });
      await db.document.update({
        where: { id: packingList.id },
        data: { originProformaId: proforma.id },
      });

      results = [proforma, invoice, packingList].map((d) => serializeDocument(d as unknown as Record<string, unknown>));

    } else if (data.documentType === "invoice") {
      // CASCADE: Create Invoice + Packing List
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });
      const invFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;

      const [invoice, packingList] = await db.$transaction([
        db.document.create({
          data: {
            ...baseData,
            number,
            documentType: "invoice",
            status: data.status,
            financialDetails: invFinancial,
          },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: {
            ...baseData,
            number: `${number}-PL`,
            documentType: "packing_list",
            status: data.status,
            financialDetails: plFinancial,
            originProformaId: undefined,
          },
          include: { sender: true, recipient: true },
        }),
      ]);

      await db.document.update({
        where: { id: packingList.id },
        data: { originProformaId: invoice.id },
      });

      results = [invoice, packingList].map((d) => serializeDocument(d as unknown as Record<string, unknown>));

    } else {
      // Packing List only — no cascade
      const plFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;
      const doc = await db.document.create({
        data: {
          ...baseData,
          number,
          documentType: "packing_list",
          status: data.status,
          financialDetails: plFinancial,
        },
        include: { sender: true, recipient: true },
      });
      results = [serializeDocument(doc as unknown as Record<string, unknown>)];
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
}