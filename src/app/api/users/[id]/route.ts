import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-api";
import { auditLog } from "@/lib/audit-log";
import { hash } from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  name: z.string().optional(),
  role: z.enum(["admin", "logistica", "comercial"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireRole("admin");
  if (authUser instanceof NextResponse) return authUser;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.email) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.password) updateData.passwordHash = await hash(data.password, 10);

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    await auditLog({
      userId: authUser.id,
      userEmail: authUser.email,
      action: "user.update",
      entity: "user",
      entityId: id,
      details: JSON.stringify({ role: data.role, email: data.email }),
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireRole("admin");
  if (authUser instanceof NextResponse) return authUser;

  try {
    const { id } = await params;

    await auditLog({
      userId: authUser.id,
      userEmail: authUser.email,
      action: "user.delete",
      entity: "user",
      entityId: id,
    });

    await db.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
