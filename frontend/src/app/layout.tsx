import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "./_components/Sidebar";

export const metadata: Metadata = {
  title: "52주 트렌드 대시보드",
  description: "52주 고점 기반 테마 트렌드 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-gray-900 text-white min-h-screen">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-gray-900">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
