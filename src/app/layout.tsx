import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tidepath | Every record, a way forward",
  description: "Reconcile donation records and prepare evidence-backed reports inside Google Sheets. Your review, your records, your approval.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
