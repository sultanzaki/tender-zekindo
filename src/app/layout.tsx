import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { getAuthContext } from "@/lib/auth/dal";
import { getNotificationCounts } from "@/lib/tenders";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tender Management — Zekindo",
  description: "Monitoring and management of oil & gas tenders for PT Zeus Kimiatama Indonesia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();

  let notificationCount = 0;
  if (ctx) {
    try {
      // The badge counts what needs acting on: milestones inside the 3-day
      // reminder window, plus tenders with nothing scheduled ahead. The wider
      // 14-day list stays on /notifications for planning.
      const counts = await getNotificationCounts();
      notificationCount = counts.dueH3 + counts.stalled;
    } catch {
      notificationCount = 0;
    }
  }

  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <TopNav profile={ctx?.profile ?? null} notificationCount={notificationCount} />
        {children}
      </body>
    </html>
  );
}
