import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().nullable().optional(),
  role: z.enum(["admin", "logistica", "comercial"]).optional(),
  password: z.string().min(4).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (data.email && data.email !== existing.email) {
      const emailTaken = await db.user.findUnique({ where: { email: data.email } });
      if (emailTaken) {
        return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) {
      updateData.passwordHash = await hash(data.password, 10);
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message, details: JSON.stringify(error.issues) }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update user", details: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete user", details: msg }, { status: 500 });
  }
}
