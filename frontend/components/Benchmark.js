"use client";

import { useRef, useState } from "react";

// Fires a fixed batch of requests at every algorithm (fresh key each run) and
// reports allow-rate, throughput and latency percentiles — real numbers from
// real HTTP round-trips into the C++ engine.

const ALGOS = [
  { id: "token_bucket", title: "Token Bucket" },
  { id: "leaking_bucket", title: "Leaking Bucket" },
  { id: "fixed_window", title: "Fixed Window" },
  { id: "sliding_window_log", title: "Sliding Window Log" },
  { id: "sliding_window_counter", title: "Sliding Window Counter" },
];

const REQUESTS = 250;   // per algorithm
const CONCURRENCY = 20; // parallel in-flight requests

async function benchOne(algoId, onProgress) {
  const key = `bench-${algoId}-${Date.now()}`;
  const lats = [];
  let allowed = 0;
  let started = 0;
  const t0 = performance.now();

  async function worker() {
    for (;;) {
      if (started >= REQUESTS) return;
      started++;
      const s = performance.now();
      try {
        const r = await fetch(`/api/check?algo=${algoId}&key=${key}&cost=1`);
        const d = await r.json().catch(() => null);
        if (d && d.allowed) allowed++;
      } catch {
        /* count as denied */
      }
      lats.push(performance.now() - s);
      if (lats.length % 25 === 0) onProgress(lats.length / REQUESTS);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const totalS = (performance.now() - t0) / 1000;
  lats.sort((a, b) => a - b);
  const at = (p) => lats[Math.min(lats.length - 1, Math.floor(lats.length * p))];
  return {
    id: algoId,
    allowed,
    denied: REQUESTS - allowed,
    rps: REQUESTS / totalS,
    avg: lats.reduce((s, x) => s + x, 0) / lats.length,
    p99: at(0.99),
  };
}

export default function Benchmark() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // {title, frac}
  const [results, setResults] = useState(null);
  const busyRef = useRef(false);

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    setRunning(true);
    setResults(null);
    const out = [];
    for (const a of ALGOS) {
      setProgress({ title: a.title, frac: 0 });
      out.push(await benchOne(a.id, (f) => setProgress({ title: a.title, frac: f })));
    }
    setResults(out);
    setProgress(null);
    setRunning(false);
    busyRef.current = false;
  }

  const bestRps = results && Math.max(...results.map((r) => r.rps));
  const bestP99 = results && Math.min(...results.map((r) => r.p99));

  return (
    <section className="bench">
      <div className="bench-head">
        <div>
          <h3>Benchmark</h3>
          <p className="muted">
            Fires {REQUESTS} requests at each algorithm ({CONCURRENCY} in parallel) through real
            HTTP round-trips into the C++ engine, with default parameters and a fresh key.
          </p>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running}>
          {running ? "Running…" : "▶ Run benchmark"}
        </button>
      </div>

      {progress && (
        <div className="bench-progress">
          <span className="muted small">{progress.title}</span>
          <div className="bench-bar"><i style={{ width: `${Math.round(progress.frac * 100)}%` }} /></div>
        </div>
      )}

      {results && (
        <div className="bench-table-wrap">
          <table className="bench-table">
            <thead>
              <tr>
                <th>Algorithm</th><th>Allowed</th><th>Denied</th><th>Allow %</th>
                <th>Throughput</th><th>Avg</th><th>p99</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const title = ALGOS.find((a) => a.id === r.id).title;
                return (
                  <tr key={r.id}>
                    <td className="bt-name">{title}</td>
                    <td className="ok-txt">{r.allowed}</td>
                    <td className="bad-txt">{r.denied}</td>
                    <td>{Math.round((r.allowed / REQUESTS) * 100)}%</td>
                    <td className={r.rps === bestRps ? "best" : ""}>{Math.round(r.rps)} req/s</td>
                    <td>{r.avg.toFixed(1)} ms</td>
                    <td className={r.p99 === bestP99 ? "best" : ""}>{r.p99.toFixed(1)} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small bench-note">
            ★ latency includes the browser → Next proxy → Node → C++ round-trip, not just the
            algorithm itself. Allow-rates differ because each algorithm shapes the same burst differently.
          </p>
        </div>
      )}
    </section>
  );
}
