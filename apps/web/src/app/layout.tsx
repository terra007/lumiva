import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMIVA – Klarheit für deine Praxis",
  description:
    "Termine, Honorarnoten und Dokumentation für psychotherapeutische Praxen in Österreich.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de-AT" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
