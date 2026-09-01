import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import { TextareaAutosize } from "@/components/textarea-autosize";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARCADIA | Muebles en cuero",
  description: "Sistema interno para producción, stock y seguimiento de taller.",
  icons: {
    icon: [
      { url: brand.icon, type: "image/svg+xml" },
      { url: brand.iconPng, type: "image/png" },
    ],
    shortcut: brand.icon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TextareaAutosize />
        {children}
      </body>
    </html>
  );
}
