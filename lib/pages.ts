import { TOTAL, SSTART } from "./quran";
// رقم صفحة المصحف لكل آية، ووزن كل آية بالأوجه
let cache: number[] | null = null;
let weights: number[] | null = null;
export async function loadPages() {
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
export async function ayahWeights() {
  if (weights) return weights;
  try {
    const p = await loadPages(); const cnt: Record<number, number> = {};
    p.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1));
    weights = p.map((x) => 1 / cnt[x]);
  } catch { weights = new Array(TOTAL).fill(604 / TOTAL); }
  return weights;
}
export async function rangePages(surah: number, from: number, to: number) {
  const w = await ayahWeights(); let s = 0; const a = SSTART[surah - 1];
  for (let i = from; i <= to; i++) s += w[a + i - 1] || 0;
  return s;
}
