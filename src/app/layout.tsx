import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vpscoaster.live"),
  title: {
    default: "WhatsApp CRM for Teams, Broadcasts, Contacts and AI Automation",
    template: "%s - WACRM",
  },
  description:
    "Production-ready WhatsApp CRM for team inboxes, contacts, broadcasts, templates, AI workflows, follow-ups, and sales pipelines.",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/icon" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1b15",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 font-sans text-white">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "rgb(13 27 21)",
              border: "1px solid rgb(49 88 70)",
              color: "white",
            },
          }}
        />
      </body>
    </html>
  );
}
