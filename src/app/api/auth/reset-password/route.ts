import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

/**
 * POST /api/auth/reset-password
 * Body: { email: string, newPassword: string }
 * Resets a user's password. Useful for initial setup or recovery.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: "Email and newPassword are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const passwordHash = await hash(newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Verify the hash was stored correctly
    const updated = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    return NextResponse.json({
      ok: true,
      message: `Password reset for ${user.email}`,
      hashLength: updated?.passwordHash?.length ?? 0,
      hashPreview: updated?.passwordHash?.substring(0, 10) + "..." + updated?.passwordHash?.substring(updated.passwordHash.length - 5),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
