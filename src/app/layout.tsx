import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phoenix Creator Bench — Stories Built to Become Worlds",
  description: "A unified creative production workbench for stories, comics, screen projects, images, characters, worlds, and production assets.",
  icons: { icon: "/phoenix-creator-bench-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#050815] text-white">
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
