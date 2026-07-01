import Link from "next/link";

// Shared Vynk-style top nav used on both the landing and the simulator, so the
// two pages share one consistent theme.
export default function SiteNav() {
  return (
    <nav className="vnav">
      <Link href="/" className="vnav-left vnav-brand">
        <span className="vlogo">R</span>
        <b>RateLimiter</b>
      </Link>
      <div className="vnav-mid">
        <Link href="/">Home</Link>
        <Link href="/#demo">Demo</Link>
        <Link href="/#algos">Algorithms</Link>
        <Link href="/simulator">Simulator</Link>
      </div>
    </nav>
  );
}
