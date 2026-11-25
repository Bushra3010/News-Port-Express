import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import "./admin.css";

const mukta = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "600", "700", "800"], variable: "--font-mukta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Admin – NewsPort Express", template: "%s – Admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mukta.variable}>
      <body>{children}</body>
    </html>
  );
}
