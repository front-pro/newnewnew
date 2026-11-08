import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "KT Neural Document Agent",
  description: "Құжаттарды салыстыру және үлгілерді өңдеу жүйесі",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="kk" className="h-full antialiased" suppressHydrationWarning><body className="min-h-full flex flex-col"><script dangerouslySetInnerHTML={{ __html: `try { if (localStorage.getItem("kt-agent-theme") === "dark") document.documentElement.classList.add("dark"); } catch {}` }} />{children}</body></html>;
}
