import { SSTART } from "./quran";
// مصحف المدينة النبوية من مجمع الملك فهد (604 صفحة، 15 سطر): رقم الصفحة وعدد الأسطر لكل آية
import M from "./mushaf.json";
const DATA = M as unknown as { pages: number[]; lines: number[] };
export async function loadPages() { return DATA.pages; }
export function mushafData() { return DATA; }
/** وزن كل آية بالأوجه = أسطرها ÷ 15 */
const W = DATA.lines.map((l) => l / 15);
export async function ayahWeights() { return W; }
export async function rangePages(surah: number, from: number, to: number) {
  let s = 0; const a = SSTART[surah - 1];
  for (let i = from; i <= to; i++) s += W[a + i - 1] || 0;
  return s;
}
