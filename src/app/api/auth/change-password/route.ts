import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/automations/admin-client";
import { createClient } from "@/lib/supabase/server";

function passwordValidationError(password: string) {
  if (password.length < 8) return "New password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "New password needs at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "New password needs at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "New password needs at least one number.";
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const validationError = passwordValidationError(newPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: "Could not load account." }, { status: 500 });
  }
  if (!profile?.must_change_password) {
    return NextResponse.json({ error: "Password change is not required." }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    return NextResponse.json(
      { error: "Password update failed. Please try again." },
      { status: 500 },
    );
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({
      must_change_password: false,
      temporary_password_set_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (profileUpdateError) {
    return NextResponse.json(
      { error: "Password changed, but account flag update failed. Please contact support." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
