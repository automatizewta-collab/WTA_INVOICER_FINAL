import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await db.item.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("GET /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch item" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const item = await db.item.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updated = await db.item.update({
      where: { id },
      data: {
        code: body.code ?? item.code,
        namePt: body.namePt ?? item.namePt,
        nameEn: body.nameEn ?? item.nameEn,
        nameEs: body.nameEs !== undefined ? body.nameEs : item.nameEs,
        unitValueUsd: body.unitValueUsd ?? item.unitValueUsd,
        grossWeight: body.grossWeight ?? item.grossWeight,
        netWeight: body.netWeight ?? item.netWeight,
        htsusCode: body.htsusCode !== undefined ? body.htsusCode : item.htsusCode,
        endUse: body.endUse !== undefined ? body.endUse : item.endUse,
        endUseEs: body.endUseEs !== undefined ? body.endUseEs : item.endUseEs,
        sterileAtImport: body.sterileAtImport ?? item.sterileAtImport,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await db.item.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    await db.item.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 }
    );
  }
}