import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type && type !== "all") where.type = type;

    const companies = await db.company.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(companies);
  } catch {
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  type: z.enum(["sender", "recipient"]),
  contactName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  stateRegistration: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  logoUrl: z.string().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
  midCode: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = createSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const data = {
      name: body.name.trim(),
      type: body.type,
      contactName: body.contactName?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      postalCode: body.postalCode?.trim() || null,
      state: body.state?.trim() || null,
      country: body.country?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      cnpj: body.cnpj?.trim() || null,
      stateRegistration: body.stateRegistration?.trim() || null,
      isDefault: body.isDefault,
      logoUrl: body.logoUrl?.trim() || null,
      bankDetails: body.bankDetails?.trim() || null,
      midCode: body.midCode?.trim() || null,
    };

    if (data.isDefault) {
      await db.company.updateMany({
        where: { type: data.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const company = await db.company.create({ data });
    return NextResponse.json(company, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 },
    );
  }
}
