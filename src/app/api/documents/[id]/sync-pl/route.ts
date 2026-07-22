import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonField } from "@/lib/utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pl = await db.document.findUnique({ where: { id } });
    if (!pl || pl.documentType !== "packing_list") {
      return NextResponse.json(
        { error: "Packing List not found" },
        { status: 404 }
      );
    }

    // Remove "-PL" suffix to find parent Invoice
    let invoiceNumber = pl.number;
    if (invoiceNumber.endsWith("-PL")) {
      invoiceNumber = invoiceNumber.slice(0, -3);
    }

    const invoice = await db.document.findUnique({
      where: { number: invoiceNumber },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice "${invoiceNumber}" not found` },
        { status: 404 }
      );
    }

    // Copy items, shipment, dates, notes from Invoice to PL
    const updated = await db.document.update({
      where: { id: pl.id },
      data: {
        items: invoice.items,
        shipmentDetails: invoice.shipmentDetails,
        date: invoice.date,
        notes: invoice.notes,
        senderId: invoice.senderId,
        recipientId: invoice.recipientId,
        language: invoice.language,
      },
      include: { sender: true, recipient: true },
    });

    return NextResponse.json({
      success: true,
      message: `Packing List synced with Invoice ${invoiceNumber}`,
      document: {
        id: updated.id,
        number: updated.number,
        items: parseJsonField(updated.items, []),
      },
    });
  } catch (error) {
    console.error("POST /api/documents/[id]/sync-pl error:", error);
    return NextResponse.json(
      { error: "Failed to sync Packing List" },
      { status: 500 }
    );
  }
}