import type { Metadata } from "next";

import { PlatformAdminShell } from "@/components/admin/platform-admin-shell";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminTopsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlatformAdminShell>{children}</PlatformAdminShell>;
}
