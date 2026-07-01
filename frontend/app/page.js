import Link from "next/link";
import LandingHero from "../components/LandingHero";
import SiteNav from "../components/SiteNav";
import FX from "../components/FX";

const ALGOS = [
  { n: "Token Bucket", d: "Allows bursts up to capacity, bounds the average.", i: "🪙" },
  { n: "Leaking Bucket", d: "Leaks at a constant rate — a perfectly smooth stream.", i: "💧" },
  { n: "Fixed Window", d: "N requests per fixed window. Simplest & cheapest.", i: "🪟" },
  { n: "Sliding Window Log", d: "A timestamp per request — exact, no edge bursts.", i: "📜" },
  { n: "Sliding Window Counter", d: "Near-exact accuracy at O(1) memory.", i: "🎚️" },
];

const TECH = ["C++", "N-API", "Node.js", "Express", "Next.js", "React"];

const STATS = [
  { v: 5, suffix: "", label: "algorithms, one engine" },
  { v: 19, suffix: "", label: "C++ checks passing" },
  { v: 60, suffix: " fps", label: "canvas animation" },
  { v: 1, suffix: " ms", prefix: "≈", label: "decision round-trip" },
];

export default function Landing() {
  return (
    <div className="landing vgrid">
      <FX />
      <SiteNav />

      {/* ---- hero ---- */}
      <header className="vhero">
        <span className="hero-badge rise" style={{ "--d": "0ms" }}>
          <span className="live-dot" /> Live C++ engine under the hood
        </span>
        <h1 className="vhero-title">
          <span className="trow rise" style={{ "--d": "90ms" }}>Skip the Theory.</span>
          <span className="trow rise" style={{ "--d": "200ms" }}>Watch It Happen.</span>
        </h1>
        <p className="vhero-sub rise" style={{ "--d": "320ms" }}>
          Five classic rate-limiting algorithms, animated in real time. Real decisions
          from a thread-safe <b>C++ engine</b> — no boilerplate, just insight.
        </p>
        <div className="vbtns rise" style={{ "--d": "430ms" }}>
          <Link href="/simulator" className="btn btn-white big">Get Started</Link>
          <a href="#algos" className="btn btn-line big">Browse Algorithms</a>
        </div>
        <div className="techrow rise" style={{ "--d": "560ms" }}>
          {TECH.map((t) => <span className="tech" key={t}>{t}</span>)}
        </div>
        <a href="#demo" className="scroll-hint" aria-label="Scroll to the live demo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </header>

      {/* ---- stats band ---- */}
      <div className="stats-band" data-reveal>
        {STATS.map((s) => (
          <div className="stat-cell" key={s.label}>
            <b data-count={s.v} data-suffix={s.suffix} data-prefix={s.prefix || ""}>0</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ---- live demo ---- */}
      <section id="demo" className="lsection" data-reveal>
        <span className="kicker">01 · Live demo</span>
        <h2>Not a mockup — <span className="grad">a live engine</span></h2>
        <p className="lsub">Tokens refill, requests spend them. Click anywhere in the box to fire.</p>
        <LandingHero />
      </section>

      {/* ---- algorithms ---- */}
      <section id="algos" className="lsection" data-reveal>
        <span className="kicker">02 · The algorithms</span>
        <h2>Five algorithms, <span className="grad">one playground</span></h2>
        <p className="lsub">Each gets its own live, animated mechanism in the simulator.</p>
        <div className="lgrid algos">
          {ALGOS.map((a, i) => (
            <Link href="/simulator" className="lcard algo" key={a.n}>
              <div className="algo-head">
                <span className="algo-ico">{a.i}</span>
                <span className="algo-num">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3>{a.n}</h3>
              <p>{a.d}</p>
              <span className="algo-go">Try it →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- how it works ---- */}
      <section id="how" className="lsection" data-reveal>
        <span className="kicker">03 · Under the hood</span>
        <h2>Real backend, <span className="grad">not a fake</span></h2>
        <p className="lsub">The simulator's decisions come from actual compiled C++.</p>
        <div className="pipe">
          <div className="pipe-step"><span className="pipe-ico">🖥️</span><h4>Next.js UI</h4>
            <p>Animated simulator; calls <code>/api/*</code>, proxied to the backend (no CORS).</p></div>
          <div className="pipe-arrow">→</div>
          <div className="pipe-step"><span className="pipe-ico">🟢</span><h4>Node (Express)</h4>
            <p>Routes each request straight into the native addon.</p></div>
          <div className="pipe-arrow">→</div>
          <div className="pipe-step"><span className="pipe-ico">⚡</span><h4>C++ algorithms</h4>
            <p>Thread-safe limiters compiled into an N-API <code>.node</code> addon.</p></div>
        </div>
      </section>

      <section className="cta-band" data-reveal>
        <h2>Go break some limits</h2>
        <p>Fire a DDoS spike, drag the sliders, and watch each algorithm fight back.</p>
        <div className="vbtns">
          <Link href="/simulator" className="btn btn-white big">▶ Launch the simulator</Link>
          <a href="https://github.com/subhm2004/Rate_Limiter" target="_blank" rel="noopener noreferrer"
            className="btn btn-line big">View on GitHub</a>
        </div>
      </section>

      <footer className="lfooter2">
        <div className="lf-grid">
          <div className="lf-brand">
            <div className="lf-logo"><span className="vlogo">R</span><b>RateLimiter</b></div>
            <p>Rate limiting, visualized. Real decisions from a thread-safe C++ engine, animated in your browser.</p>
          </div>
          <div className="lf-col">
            <h5>Explore</h5>
            <Link href="/simulator">Simulator</Link>
            <Link href="/compare">Compare</Link>
            <a href="https://github.com/subhm2004/Rate_Limiter" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
          <div className="lf-col">
            <h5>Stack</h5>
            <span>C++17 engine · N-API</span>
            <span>Node.js · Express</span>
            <span>Next.js · React</span>
          </div>
        </div>
        <div className="lf-bottom">
          <span>MIT License</span>
          <span>Built to <em>see</em> how rate limiting actually works</span>
        </div>
      </footer>
    </div>
  );
}
