import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Katha",
  description: "Ultra-fast messaging app",
  manifest: "/manifest.json",
  icons: {
    icon: "/katha.svg",
    apple: "/katha.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} h-mobile-screen overflow-hidden`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}