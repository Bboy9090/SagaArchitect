import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saga Architect — Universe Bible Generator",
  description: "Build your universe bible. Track your canon. Generate your saga.",
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
        {children}
      </body>
    </html>
  );
}
