import Link from "next/link";
import { Clock, LogIn, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { approvalMessage } from "@/lib/auth/approval";
import { createClient } from "@/lib/supabase/server";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("approval_status, email")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const status = profile?.approval_status ?? "pending";
  const isBlocked = status === "rejected" || status === "suspended";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
            {isBlocked ? (
              <ShieldAlert className="h-6 w-6 text-amber-300" />
            ) : (
              <Clock className="h-6 w-6 text-amber-300" />
            )}
          </div>
          <CardTitle className="text-xl text-white">
            {isBlocked ? "Account access blocked" : "Pending admin approval"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {approvalMessage(status)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-500">
            {profile?.email
              ? `Signed in as ${profile.email}`
              : "Please sign in again to check your approval status."}
          </p>
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogIn className="h-4 w-4" />
              Back to login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
