import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/automations/admin-client";

function passwordValidationError(password: string) {
  if (password.length < 8) return "New password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "New password needs at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "New password needs at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "New password needs at least one number.";
  return null;
}

export async function POST(request: Request) {
  const adminCheck = await requirePlatformAdmin();
  if ("error" in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status },
    );
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Current password is required." },
      { status: 400 },
    );
  }

  const validationError = passwordValidationError(newPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "New password must be different from the current password." },
      { status: 400 },
    );
  }

  const email = adminCheck.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "Could not verify this admin account." },
      { status: 400 },
    );
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabaseAdmin().auth.admin.updateUserById(
    adminCheck.user.id,
    { password: newPassword },
  );

  if (updateError) {
    return NextResponse.json(
      { error: "Password update failed. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
