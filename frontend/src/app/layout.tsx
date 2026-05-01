import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventra — Hospitality Inventory Management",
  description: "Enterprise-grade inventory management system for hospitality operations. Track stock, manage suppliers, and audit transactions in real-time.",
};

import Providers from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

