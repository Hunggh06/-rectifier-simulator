import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Simulator Chỉnh lưu — Simulink Verified",
  description:
    "Mô phỏng và đối chiếu 12 mạch chỉnh lưu Diode/Thyristor với dữ liệu kiểm chứng từ MATLAB/Simulink.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`dark ${outfit.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  );
}
