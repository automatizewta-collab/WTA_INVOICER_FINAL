import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    recipientInfo: doc.recipientInfo ? JSON.parse(doc.recipientInfo as string) : null,
    orderNumber: doc.orderNumber,
    shipmentDetails: doc.shipmentDetails ? JSON.parse(doc.shipmentDetails as string) : null,
    financialDetails: doc.financialDetails ? JSON.parse(doc.financialDetails as string) : null,
    notes: doc.notes ? JSON.parse(doc.notes as string) : [],
    pdfUrl: doc.pdfUrl,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
    sender: doc.sender,
    recipient: doc.recipient,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({
      where: { id },
      include: { sender: true, recipient: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(serializeDocument(document as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const originalNumber = document.number;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (body.documentType !== undefined) updateData.documentType = body.documentType;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.senderId !== undefined) updateData.senderId = body.senderId;
    if (body.recipientId !== undefined) updateData.recipientId = body.recipientId;
    if (body.items !== undefined) updateData.items = JSON.stringify(body.items);
    if (body.dollarExchangeRate !== undefined) updateData.dollarExchangeRate = body.dollarExchangeRate;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.htsusColumnTitle !== undefined) updateData.htsusColumnTitle = body.htsusColumnTitle;
    if (body.showSterileColumn !== undefined) updateData.showSterileColumn = body.showSterileColumn;
    if (body.showEndUseColumn !== undefined) updateData.showEndUseColumn = body.showEndUseColumn;
    if (body.shipmentDetails !== undefined) updateData.shipmentDetails = JSON.stringify(body.shipmentDetails);
    if (body.financialDetails !== undefined) updateData.financialDetails = JSON.stringify(body.financialDetails);
    if (body.notes !== undefined) updateData.notes = JSON.stringify(body.notes);
    if (body.recipientInfo !== undefined) updateData.recipientInfo = JSON.stringify(body.recipientInfo);

    const updated = await db.document.update({
      where: { id },
      data: updateData,
      include: { sender: true, recipient: true },
    });

    // SYNC LOGIC: Propagate changes to child documents
    const syncFields: Record<string, unknown> = {};
    if (body.items !== undefined) syncFields.items = updateData.items;
    if (body.shipmentDetails !== undefined) syncFields.shipmentDetails = updateData.shipmentDetails;
    if (body.notes !== undefined) syncFields.notes = updateData.notes;
    if (body.date !== undefined) syncFields.date = updateData.date;
    if (body.senderId !== undefined) syncFields.senderId = body.senderId;
    if (body.recipientId !== undefined) syncFields.recipientId = body.recipientId;
    if (body.recipientInfo !== undefined) syncFields.recipientInfo = updateData.recipientInfo;

    if (Object.keys(syncFields).length > 0) {
      if (document.documentType === "proforma") {
        // Find Invoice child by ORIGINAL number + "-INV"
        const invNumber = `${originalNumber}-INV`;
        const plNumber = `${originalNumber}-PL`;

        const existingInv = await db.document.findUnique({ where: { number: invNumber } });
        const existingPl = await db.document.findUnique({ where: { number: plNumber } });

        if (existingInv) {
          await db.document.update({ where: { id: existingInv.id }, data: syncFields });
        }
        if (existingPl) {
          const plSync = { ...syncFields };
          // Packing List financial stays zeroed
          delete plSync.financialDetails;
          await db.document.update({ where: { id: existingPl.id }, data: plSync });
        }
      } else if (document.documentType === "invoice") {
        // Find PL child by NEW number + "-PL"
        const newNumber = body.number || document.number;
        const plNumber = `${newNumber}-PL`;
        const existingPl = await db.document.findUnique({ where: { number: plNumber } });
        if (existingPl) {
          const plSync = { ...syncFields };
          delete plSync.financialDetails;
          await db.document.update({ where: { id: existingPl.id }, data: plSync });
        }
      }
    }

    return NextResponse.json(serializeDocument(updated as unknown as Record<string, unknown>));
  } catch (error) {
    console.error("PUT /api/documents/[id] error:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Also delete child documents
    if (document.documentType === "proforma") {
      await db.document.deleteMany({
        where: {
          OR: [
            { number: `${document.number}-INV` },
            { number: `${document.number}-PL` },
          ],
        },
      });
    } else if (document.documentType === "invoice") {
      await db.document.deleteMany({
        where: { number: `${document.number}-PL` },
      });
    }

    await db.document.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/documents/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}