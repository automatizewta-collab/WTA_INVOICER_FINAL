// ============================================
// Issue a draft document → cascade (Proforma → Invoice + PL)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonField } from "@/lib/utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await db.document.findUnique({
      where: { id },
      include: { sender: true, recipient: true },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.status === "issued") {
      return NextResponse.json({ error: "Document is already issued" }, { status: 400 });
    }

    // Update the document to issued
    const totalValue = (() => {
      const fd = parseJsonField<Record<string, number>>(doc.financialDetails, {});
      return fd.total_value || 0;
    })();

    const issued = await db.document.update({
      where: { id },
      data: {
        status: "issued",
        financialDetails: doc.financialDetails
          ? JSON.stringify({ ...parseJsonField<Record<string, number>>(doc.financialDetails, {}), total_value: totalValue })
          : null,
      },
      include: { sender: true, recipient: true },
    });

    const results = [issued];

    // ── Cascade: create child documents ──
    const baseData = {
      date: doc.date,
      senderId: doc.senderId,
      recipientId: doc.recipientId,
      items: doc.items,
      dollarExchangeRate: doc.dollarExchangeRate,
      currency: doc.currency,
      htsusColumnTitle: doc.htsusColumnTitle,
      showSterileColumn: doc.showSterileColumn,
      shipmentDetails: doc.shipmentDetails,
      notes: doc.notes,
      contactName: doc.contactName,
      contactPhone: doc.contactPhone,
      orderNumber: doc.orderNumber,
      language: doc.language,
      status: "issued" as const,
    };

    if (doc.documentType === "proforma") {
      // Create Invoice + Packing List
      const invFinancial = doc.financialDetails;
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });

      const [invoice, packingList] = await db.$transaction([
        db.document.create({
          data: {
            ...baseData,
            number: `${doc.number}-INV`,
            documentType: "invoice",
            financialDetails: invFinancial,
          },
          include: { sender: true, recipient: true },
        }),
        db.document.create({
          data: {
            ...baseData,
            number: `${doc.number}-PL`,
            documentType: "packing_list",
            financialDetails: plFinancial,
          },
          include: { sender: true, recipient: true },
        }),
      ]);

      await db.document.update({
        where: { id: invoice.id },
        data: { originProformaId: doc.id },
      });
      await db.document.update({
        where: { id: packingList.id },
        data: { originProformaId: doc.id },
      });

      results.push(invoice, packingList);

    } else if (doc.documentType === "invoice") {
      // Create Packing List only
      const plFinancial = JSON.stringify({
        discount: 0, shipping_cost: 0, insurance: 0, bank_fees: 0, total_value: 0,
      });

      const packingList = await db.document.create({
        data: {
          ...baseData,
          number: `${doc.number}-PL`,
          documentType: "packing_list",
          financialDetails: plFinancial,
        },
        include: { sender: true, recipient: true },
      });

      await db.document.update({
        where: { id: packingList.id },
        data: { originProformaId: doc.id },
      });

      results.push(packingList);
    }

    // Packing List alone → no cascade needed

    const serialize = (d: typeof issued) => ({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
      number: d.number,
      date: new Date(d.date).toISOString(),
    });

    console.log(`[DOC] Issued ${doc.documentType} ${doc.number} → ${results.length - 1} child docs`);
    return NextResponse.json(results.map(serialize));
  } catch (error) {
    console.error("[DOC] Issue error:", error);
    return NextResponse.json({ error: "Failed to issue document" }, { status: 500 });
  }
}