import Link from "next/link";

// Shared top nav used on both the landing and the simulator, so the two pages
// share one consistent theme. Sticky, blurred, full-width border.
export default function SiteNav() {
  return (
    <nav className="vnav">
      <div className="vnav-in">
        <Link href="/" className="vnav-left vnav-brand">
          <span className="vlogo">R</span>
          <b>RateLimiter</b>
        </Link>
        <div className="vnav-mid">
          <Link href="/">Home</Link>
          <Link href="/#demo">Demo</Link>
          <Link href="/#algos">Algorithms</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/simulator" className="vnav-cta">Simulator</Link>
        </div>
      </div>
    </nav>
  );
}
