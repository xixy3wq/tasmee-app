import Script from "next/script";
import { APP_V } from "@/lib/version";
// الواجهة كاملة في public/app.js، والبيانات من مسارات /api
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <>
      <div id="root"><div id="app"><div className="center-box"><div className="row"><div className="spin"></div><span className="muted">جاري التحميل…</span></div></div></div></div>
      <div id="modal" hidden></div>
      <div id="toast" hidden></div>
      <Script src={`/app.js?v=${APP_V}`} strategy="afterInteractive" />
    </>
  );
}
