import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "حلقات ارتق",
  description: "منصة حلقات ارتق عن بُعد: الحصص والتحضير والتسميع والخطط ومتابعة ولي الأمر",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/apple-180.png" },
  appleWebApp: { capable: true, title: "ارتق", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f1e7" }, { media: "(prefers-color-scheme: dark)", color: "#17130f" }], width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Amiri:wght@400;700&family=Amiri+Quran&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
