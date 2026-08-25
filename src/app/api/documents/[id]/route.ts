import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeDocument } from "@/lib/serialize-document";
import { documentUpdateSchema } from "@/lib/document-schemas";
import { z } from "zod";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params;
    const id = resolved?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
    }
    const document = await db.document.findUnique({
      where: { id },
      include: { sender: true, recipient: true },
    });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(serializeDocument(document as unknown as Record<string, unknown>));
  } catch {
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

    // Validate input with Zod
    const data = documentUpdateSchema.parse(body);

    const document = await db.document.findUnique({ where: { id } });
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const originalNumber = document.number;

    // Build update data — only include fields that were explicitly provided
    const updateData: Record<string, unknown> = {};
    if (data.documentType !== undefined) updateData.documentType = data.documentType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.language !== undefined) updateData.language = data.language;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.senderId !== undefined) updateData.senderId = data.senderId;
    if (data.recipientId !== undefined) updateData.recipientId = data.recipientId;
    if (data.items !== undefined) updateData.items = JSON.stringify(data.items);
    if (data.dollarExchangeRate !== undefined) updateData.dollarExchangeRate = data.dollarExchangeRate;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.htsusColumnTitle !== undefined) updateData.htsusColumnTitle = data.htsusColumnTitle;
    if (data.showSterileColumn !== undefined) updateData.showSterileColumn = data.showSterileColumn;
    if (data.showEndUseColumn !== undefined) updateData.showEndUseColumn = data.showEndUseColumn;
    if (data.shipmentDetails !== undefined) updateData.shipmentDetails = JSON.stringify(data.shipmentDetails);
    if (data.financialDetails !== undefined) updateData.financialDetails = JSON.stringify(data.financialDetails);
    if (data.notes !== undefined) updateData.notes = JSON.stringify(data.notes);
    if (data.recipientInfo !== undefined) updateData.recipientInfo = JSON.stringify(data.recipientInfo);
    if (data.orderNumber !== undefined) updateData.orderNumber = data.orderNumber;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;

    const updated = await db.document.update({
      where: { id },
      data: updateData,
      include: { sender: true, recipient: true },
    });

    // SYNC LOGIC: Propagate changes to child documents
    const syncFields: Record<string, unknown> = {};
    if (data.items !== undefined) syncFields.items = updateData.items;
    if (data.shipmentDetails !== undefined) syncFields.shipmentDetails = updateData.shipmentDetails;
    if (data.notes !== undefined) syncFields.notes = updateData.notes;
    if (data.date !== undefined) syncFields.date = updateData.date;
    if (data.senderId !== undefined) syncFields.senderId = data.senderId;
    if (data.recipientId !== undefined) syncFields.recipientId = data.recipientId;
    if (data.recipientInfo !== undefined) syncFields.recipientInfo = updateData.recipientInfo;
    if (data.purpose !== undefined) syncFields.purpose = updateData.purpose;
    if (data.paymentTerms !== undefined) syncFields.paymentTerms = updateData.paymentTerms;

    if (Object.keys(syncFields).length > 0) {
      if (document.documentType === "proforma") {
        const invNumber = `${originalNumber}-INV`;
        const plNumber = `${originalNumber}-PL`;

        const existingInv = await db.document.findUnique({ where: { number: invNumber } });
        const existingPl = await db.document.findUnique({ where: { number: plNumber } });

        if (existingInv) {
          await db.document.update({ where: { id: existingInv.id }, data: syncFields });
        }
        if (existingPl) {
          const plSync = { ...syncFields };
          delete plSync.financialDetails;
          await db.document.update({ where: { id: existingPl.id }, data: plSync });
        }
      } else if (document.documentType === "invoice") {
        const newNumber = data.documentType || document.number;
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[DOCUMENTS PUT] Error updating document:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to update document", details: message }, { status: 500 });
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
  } catch {
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
