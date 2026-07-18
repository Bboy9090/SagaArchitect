import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phoenix Creator Studio — Project Bible Generator",
  description: "Project Bible + Canon Engine for creators",
  icons: { icon: "/sagaarchitect-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0a0a0f] text-white">
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
