import { NextResponse } from "next/server";
import { loadPages } from "@/lib/pages";
export async function GET() {
  try {
    return NextResponse.json({ pages: await loadPages() }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "no page data" }, { status: 503 });
  }
}
