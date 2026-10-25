import { NextResponse } from "next/server";
import { TOTAL } from "@/lib/quran";
// رقم صفحة المصحف (المدينة، 604 صفحة) لكل آية، لحساب الأوجه في الخطة
let cache: number[] | null = null;
async function load() {
  if (cache) return cache;
  const m: any = await import("quran-meta");
  let get: ((i: number) => any) | null = m.getAyahMeta || m.default?.getAyahMeta || null;
  if (!get && m.QuranRiwaya?.hafs) { const h = m.QuranRiwaya.hafs(); get = (i: number) => h.getAyahMeta(i); }
  if (!get) throw new Error("quran-meta api");
  const p: number[] = [];
  for (let i = 1; i <= TOTAL; i++) p.push(Number(get(i).page));
  if (p[0] !== 1 || p[TOTAL - 1] !== 604) throw new Error("bad page data");
  cache = p;
  return p;
}
export async function GET() {
  try {
    return NextResponse.json({ pages: await load() }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "no page data" }, { status: 503 });
  }
}
