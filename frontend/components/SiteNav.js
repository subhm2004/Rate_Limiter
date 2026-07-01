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
          <a
            className="gh-btn"
            href="https://github.com/subhm2004/Rate_Limiter"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.2 1.87.86 2.33.66.07-.52.28-.86.5-1.06-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
