import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/app-provider";
import { Footer, Header } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "PreBite — Sensory menu translator",
  description: "Every menu, translated to home.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <AppProvider>
          <Header />
          <main className="min-h-[calc(100vh-104px)]">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
