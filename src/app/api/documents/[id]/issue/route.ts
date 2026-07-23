// ============================================
// Issue a draft document → cascade (Proforma → Invoice + PL)
// If child documents already exist (from POST cascade), just update their status.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      try {
        const fd = JSON.parse(doc.financialDetails || "{}");
        return fd.total_value || 0;
      } catch { return 0; }
    })();

    const issued = await db.document.update({
      where: { id },
      data: {
        status: "issued",
        financialDetails: doc.financialDetails
          ? JSON.stringify({ ...JSON.parse(doc.financialDetails), total_value: totalValue })
          : null,
      },
      include: { sender: true, recipient: true },
    });

    const results = [issued];

    // ── Check if child documents already exist ──
    const existingInv = doc.documentType === "proforma"
      ? await db.document.findUnique({ where: { number: `${doc.number}-INV` } })
      : null;
    const existingPl = await db.document.findUnique({
      where: { number: `${doc.number}-PL` },
    });

    if (doc.documentType === "proforma") {
      if (existingInv && existingPl) {
        // Children already exist → just update their status to issued
        const [updatedInv, updatedPl] = await db.$transaction([
          db.document.update({
            where: { id: existingInv.id },
            data: { status: "issued" },
            include: { sender: true, recipient: true },
          }),
          db.document.update({
            where: { id: existingPl.id },
            data: { status: "issued" },
            include: { sender: true, recipient: true },
          }),
        ]);
        results.push(updatedInv, updatedPl);
        console.log(`[DOC] Issued proforma ${doc.number} → updated existing children to issued`);
      } else {
        // Children don't exist → create them (legacy path)
        const baseData = {
          date: doc.date,
          senderId: doc.senderId,
          recipientId: doc.recipientId,
          items: doc.items,
          dollarExchangeRate: doc.dollarExchangeRate,
          currency: doc.currency,
          htsusColumnTitle: doc.htsusColumnTitle,
          showSterileColumn: doc.showSterileColumn,
          showEndUseColumn: doc.showEndUseColumn,
          shipmentDetails: doc.shipmentDetails,
          notes: doc.notes,
          contactName: doc.contactName,
          contactPhone: doc.contactPhone,
          orderNumber: doc.orderNumber,
          language: doc.language,
          status: "issued" as const,
        };

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

        await db.document.update({ where: { id: invoice.id }, data: { originProformaId: doc.id } });
        await db.document.update({ where: { id: packingList.id }, data: { originProformaId: doc.id } });

        results.push(invoice, packingList);
        console.log(`[DOC] Issued proforma ${doc.number} → created 2 new children`);
      }

    } else if (doc.documentType === "invoice") {
      if (existingPl) {
        // PL already exists → just update status
        const updatedPl = await db.document.update({
          where: { id: existingPl.id },
          data: { status: "issued" },
          include: { sender: true, recipient: true },
        });
        results.push(updatedPl);
        console.log(`[DOC] Issued invoice ${doc.number} → updated existing PL to issued`);
      } else {
        // Create PL (legacy path)
        const baseData = {
          date: doc.date,
          senderId: doc.senderId,
          recipientId: doc.recipientId,
          items: doc.items,
          dollarExchangeRate: doc.dollarExchangeRate,
          currency: doc.currency,
          htsusColumnTitle: doc.htsusColumnTitle,
          showSterileColumn: doc.showSterileColumn,
          showEndUseColumn: doc.showEndUseColumn,
          shipmentDetails: doc.shipmentDetails,
          notes: doc.notes,
          contactName: doc.contactName,
          contactPhone: doc.contactPhone,
          orderNumber: doc.orderNumber,
          language: doc.language,
          status: "issued" as const,
        };

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

        await db.document.update({ where: { id: packingList.id }, data: { originProformaId: doc.id } });
        results.push(packingList);
        console.log(`[DOC] Issued invoice ${doc.number} → created new PL`);
      }
    }

    const serialize = (d: typeof issued) => ({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
      number: d.number,
      date: new Date(d.date).toISOString(),
    });

    return NextResponse.json(results.map(serialize));
  } catch (error) {
    console.error("[DOC] Issue error:", error);
    return NextResponse.json({ error: "Failed to issue document" }, { status: 500 });
  }
}
