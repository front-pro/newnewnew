import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KT Neural Document Agent",
  description: "Құжаттарды салыстыру және үлгілерді өңдеу жүйесі",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="kk" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
