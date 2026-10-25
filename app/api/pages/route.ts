import { NextResponse } from "next/server";
import { mushafData } from "@/lib/pages";
// صفحات وأسطر مصحف المدينة النبوية (مجمع الملك فهد) لكل آية
export async function GET() {
  const d = mushafData();
  return NextResponse.json({ pages: d.pages, lines: d.lines }, { headers: { "Cache-Control": "public, max-age=604800" } });
}
