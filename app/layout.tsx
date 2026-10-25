import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "حلقات ارتق",
  description: "منصة حلقات ارتق عن بُعد: الحصص والتحضير والتسميع والخطط ومتابعة ولي الأمر",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ارتق", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#1c6a5a", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Reem+Kufi:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
