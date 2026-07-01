import Link from "next/link";
import LandingHero from "../components/LandingHero";
import SiteNav from "../components/SiteNav";

const ALGOS = [
  { n: "Token Bucket", d: "Allows bursts up to capacity, bounds the average.", i: "🪙" },
  { n: "Leaking Bucket", d: "Leaks at a constant rate — a perfectly smooth stream.", i: "💧" },
  { n: "Fixed Window", d: "N requests per fixed window. Simplest & cheapest.", i: "🪟" },
  { n: "Sliding Window Log", d: "A timestamp per request — exact, no edge bursts.", i: "📜" },
  { n: "Sliding Window Counter", d: "Near-exact accuracy at O(1) memory.", i: "🎚️" },
];

const TECH = ["C++", "N-API", "Node.js", "Express", "Next.js", "React"];

export default function Landing() {
  return (
    <div className="landing vgrid">
      <SiteNav />

      {/* ---- hero ---- */}
      <header className="vhero">
        <h1 className="vhero-title">Skip the Theory.<br />Watch It Happen.</h1>
        <p className="vhero-sub">
          Five classic rate-limiting algorithms, animated in real time. Real decisions
          from a thread-safe <b>C++ engine</b> — no boilerplate, just insight.
        </p>
        <div className="vbtns">
          <Link href="/simulator" className="btn btn-white">Get Started</Link>
          <a href="#algos" className="btn btn-line">Browse Algorithms</a>
        </div>
        <div className="techrow">
          {TECH.map((t) => <span className="tech" key={t}>{t}</span>)}
        </div>
      </header>

      {/* ---- live demo ---- */}
      <section id="demo" className="lsection">
        <h2>Not a mockup — <span className="grad">a live engine</span></h2>
        <p className="lsub">Tokens refill, requests spend them. Click anywhere in the box to fire.</p>
        <LandingHero />
      </section>

      {/* ---- algorithms ---- */}
      <section id="algos" className="lsection">
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
            </Link>
          ))}
        </div>
      </section>

      {/* ---- how it works ---- */}
      <section id="how" className="lsection">
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

      <section className="cta-band">
        <h2>Go break some limits</h2>
        <p>Fire a DDoS spike, drag the sliders, and watch each algorithm fight back.</p>
        <Link href="/simulator" className="btn btn-white big">▶ Launch the simulator</Link>
      </section>

      <footer className="lfooter">
        <span>⏱️ Rate Limiter</span>
        <span>Built to <em>see</em> how rate limiting actually works · C++ · Node · Next.js</span>
      </footer>
    </div>
  );
}
