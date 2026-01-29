import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taobao Importer - OtCommerce API",
  description: "Import products from Taobao using OtCommerce API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
