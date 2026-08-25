import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfMonth, format, parseISO } from "date-fns";
import { documentCreateSchema } from "@/lib/document-schemas";
import { serializeDocument } from "@/lib/serialize-document";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Role-based filtering: non-admin users only see their own documents
    const session = await getServerSession(authOptions);
    const currentUser = session?.user as unknown as { id: string; role: string } | undefined;
    const isAdmin = currentUser?.role === "admin";

    const where: Record<string, unknown> = {};
    if (type && type !== "all") where.documentType = type;
    if (status && status !== "all") where.status = status;
    if (search) where.number = { contains: search };
    if (!isAdmin && currentUser?.id) where.createdById = currentUser.id;

    const documents = await db.document.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { sender: true, recipient: true, createdBy: { select: { id: true, name: true, email: true } } },
    });

    const total = await db.document.count({ where });
    const draftsCount = await db.document.count({ where: { status: "draft", ...(isAdmin ? {} : currentUser?.id ? { createdById: currentUser.id } : {}) } });
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
        const fd = typeof doc.financialDetails === 'string' ? JSON.parse(doc.financialDetails) : (doc.financialDetails || {});
        return sum + ((fd as Record<string, number>).total_value || 0);
      } catch {
        return sum;
      }
    }, 0);

    return NextResponse.json({
      documents: documents.map((d) => serializeDocument(d as unknown as Record<string, unknown>)),
      counts: { total, drafts: draftsCount, thisMonth: thisMonthCount, totalValue },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = documentCreateSchema.parse(body);

    // Auth: get current user for createdById (non-blocking)
    let createdById: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      const uid = (session?.user as unknown as { id: string } | undefined)?.id;
      if (uid) {
        // Verify user exists in DB before using as FK
        const exists = await db.user.findUnique({ where: { id: uid }, select: { id: true } });
        if (exists) createdById = uid;
      }
    } catch {
      // Session unavailable — continue without createdById
    }

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
      recipientInfo: data.recipientInfo ? JSON.stringify(data.recipientInfo) : null,
      orderNumber: data.orderNumber || null,
      purpose: data.purpose || null,
      paymentTerms: data.paymentTerms || null,
      language: data.language,
      createdById,
    };

    let results: unknown[] = [];

    if (data.documentType === "proforma") {
      // CASCADE: Always create Proforma + Invoice + Packing List
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });
      const invFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;

      const [proforma, invoice, packingList] = await db.$transaction([
        db.document.create({
          data: { ...baseData, number, documentType: "proforma", status: data.status, financialDetails: invFinancial },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: { ...baseData, number: `${number}-INV`, documentType: "invoice", status: data.status, financialDetails: invFinancial },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: { ...baseData, number: `${number}-PL`, documentType: "packing_list", status: data.status, financialDetails: plFinancial },
          include: { sender: true, recipient: true },
        }),
      ]);

      await db.document.update({ where: { id: invoice.id }, data: { originProformaId: proforma.id } });
      await db.document.update({ where: { id: packingList.id }, data: { originProformaId: proforma.id } });

      results = [proforma, invoice, packingList].map((d) => serializeDocument(d as unknown as Record<string, unknown>));

    } else if (data.documentType === "invoice") {
      // CASCADE: Always create Invoice + Packing List
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });
      const invFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;

      const [invoice, packingList] = await db.$transaction([
        db.document.create({
          data: { ...baseData, number, documentType: "invoice", status: data.status, financialDetails: invFinancial },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: { ...baseData, number: `${number}-PL`, documentType: "packing_list", status: data.status, financialDetails: plFinancial },
          include: { sender: true, recipient: true },
        }),
      ]);

      await db.document.update({ where: { id: packingList.id }, data: { originProformaId: invoice.id } });

      results = [invoice, packingList].map((d) => serializeDocument(d as unknown as Record<string, unknown>));

    } else {
      // Packing List only — no cascade
      const plFinancial = data.financialDetails ? JSON.stringify(data.financialDetails) : null;
      const doc = await db.document.create({
        data: { ...baseData, number, documentType: "packing_list", status: data.status, financialDetails: plFinancial },
        include: { sender: true, recipient: true },
      });
      results = [serializeDocument(doc as unknown as Record<string, unknown>)];
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[DOCUMENTS POST] Error creating document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create document", details: message }, { status: 500 });
  }
}
