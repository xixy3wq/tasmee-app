import { shellHtml, htmlResponse } from "@/lib/shell";
// سجل الطالب الخاص لولي الأمر: يُفتح بالرابط بدون اسم مستخدم ولا كلمة مرور.
// الواجهة في public/card.js، والبيانات من /api/card (تتحقق من توقيع الرابط)
export const dynamic = "force-dynamic";
export async function GET() {
  return htmlResponse(shellHtml("سجل الطالب", "card"));
}
