import Link from "next/link";
import SiteNav from "../components/SiteNav";

export default function NotFound() {
  return (
    <div className="landing vgrid">
      <SiteNav />
      <div className="nf">
        <span className="nf-badge">HTTP 404 · Not Found</span>
        <h1 className="nf-code">404</h1>
        <p className="nf-msg">
          This route got <span className="grad">rate-limited out of existence</span>.
          <br />No retry-after header will save it.
        </p>
        <div className="vbtns">
          <Link href="/" className="btn btn-white big">← Back home</Link>
          <Link href="/simulator" className="btn btn-line big">Open the simulator</Link>
        </div>
      </div>
    </div>
  );
}
