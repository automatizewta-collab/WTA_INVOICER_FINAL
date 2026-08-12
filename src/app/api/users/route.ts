import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["admin", "logistica", "comercial"]),
  password: z.string().min(4),
});

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
    }

    const passwordHash = await hash(data.password, 10);
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name || null,
        role: data.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message, details: JSON.stringify(error.issues) }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create user", details: msg }, { status: 500 });
  }
}
