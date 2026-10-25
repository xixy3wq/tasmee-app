import Script from "next/script";
// الواجهة كاملة في public/app.js، والبيانات من مسارات /api
export default function Home() {
  return (
    <>
      <div id="root"><div id="app"><div className="center-box"><div className="row"><div className="spin"></div><span className="muted">جاري التحميل…</span></div></div></div></div>
      <div id="modal" hidden></div>
      <div id="toast" hidden></div>
      <Script src="/app.js?v=2" strategy="afterInteractive" />
    </>
  );
}
