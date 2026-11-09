import { shellHtml, htmlResponse } from "@/lib/shell";
// شاشة الجامع: تعرض نتائج اليوم مباشرة وتتحدّث لحالها. تُفتح بالرابط الموقّع من التقارير.
// الواجهة في public/screen.js، والبيانات من /api/screen
export const dynamic = "force-dynamic";
export async function GET() {
  return htmlResponse(shellHtml("شاشة الحلقات", "screen"));
}
