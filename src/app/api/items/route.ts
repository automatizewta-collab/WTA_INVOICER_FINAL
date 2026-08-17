import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

const itemSchema = z.object({
  code: z.string().min(1, "Code is required"),
  namePt: z.string().min(1, "Name (PT) is required"),
  nameEn: z.string().min(1, "Name (EN) is required"),
  nameEs: z.string().optional().nullable(),
  unitValueUsd: z.number().min(0),
  grossWeight: z.number().min(0),
  netWeight: z.number().min(0),
  htsusCode: z.string().optional().nullable(),
  endUse: z.string().optional().nullable(),
  endUseEs: z.string().optional().nullable(),
  sterileAtImport: z.string().default("NO"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 1000);
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { code: { contains: search } },
            { namePt: { contains: search } },
            { nameEn: { contains: search } },
          ],
        }
      : undefined;

    const [items, total] = await Promise.all([
      db.item.findMany({
        where,
        orderBy: { code: "asc" },
        skip,
        take: limit,
      }),
      db.item.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, limit });
  } catch {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = itemSchema.parse(body);
    const item = await db.item.create({ data });
    return NextResponse.json(item, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}