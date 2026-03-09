import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SagaLoreBuilder — Universe Bible Generator",
  description: "Build your universe bible. Track your canon. Generate your saga.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0a0a0f] text-white">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
