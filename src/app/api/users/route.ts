import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-api";
import { auditLog } from "@/lib/audit-log";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().optional(),
  role: z.enum(["admin", "logistica", "comercial"]).default("logistica"),
});

export async function GET() {
  const authUser = await requireRole("admin");
  if (authUser instanceof NextResponse) return authUser;

  try {
    const users = await db.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await requireRole("admin");
  if (authUser instanceof NextResponse) return authUser;

  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const passwordHash = await hash(data.password, 10);
    const createdUser = await db.user.create({
      data: {
        email: data.email,
        name: data.name || null,
        role: data.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    await auditLog({
      userId: authUser.id,
      userEmail: authUser.email,
      action: "user.create",
      entity: "user",
      entityId: data.email,
      details: JSON.stringify({ role: data.role }),
    });

    return NextResponse.json(createdUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
