import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar, SidebarProvider } from "@/components/sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AIGC Playground",
  description: "前端 AI 技术演练场 — SSE / Agent / 多模态",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="relative flex-1 overflow-hidden">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
