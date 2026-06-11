import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/automations/admin-client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const { data: profile, error } = await supabaseAdmin()
    .from("profiles")
    .select("account_type")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not check this email." }, { status: 500 });
  }

  if (profile?.account_type === "team_member") {
    return NextResponse.json(
      {
        error:
          "This email is already used as a team member account. Please login, or use a different email to create your own CRM workspace.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
