import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tender Management — Zekindo",
  description: "Pemantauan dan pengelolaan tender oil & gas PT Zeus Kimiatama Indonesia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
