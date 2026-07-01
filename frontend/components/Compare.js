"use client";

import { useEffect, useRef, useState } from "react";

// Compare mode: fires the SAME traffic at all five algorithms at once and shows
// each one's reaction side by side — the clearest way to see how differently
// they shape an identical stream of requests.

const ALGOS = [
  { id: "token_bucket", title: "Token Bucket", icon: "🪙" },
  { id: "leaking_bucket", title: "Leaking Bucket", icon: "💧" },
  { id: "fixed_window", title: "Fixed Window", icon: "🪟" },
  { id: "sliding_window_log", title: "Sliding Log", icon: "📜" },
  { id: "sliding_window_counter", title: "Sliding Counter", icon: "🎚️" },
];

const HISTORY = 36; // decision dots kept per algorithm

function freshState() {
  const s = {};
  for (const a of ALGOS) s[a.id] = { allowed: 0, denied: 0, used: 0, limit: 1, retry: 0, hist: [] };
  return s;
}

export default function Compare() {
  const [state, setState] = useState(freshState);
  const [auto, setAuto] = useState(false);
  const [rate, setRate] = useState(4);
  const [conn, setConn] = useState("wait");
  const keyRef = useRef("compare-1");
  const timerRef = useRef(null);

  // one tick = the same request sent to every algorithm simultaneously
  function fireOnce() {
    const key = encodeURIComponent(keyRef.current || "anon");
    for (const a of ALGOS) {
      fetch(`/api/check?algo=${a.id}&key=${key}&cost=1`)
        .then((r) => {
          if (!r.ok && r.status !== 429) throw new Error();
          return r.json();
        })
        .then((d) => {
          setConn("ok");
          setState((s) => {
            const cur = s[a.id];
            return {
              ...s,
              [a.id]: {
                allowed: cur.allowed + (d.allowed ? 1 : 0),
                denied: cur.denied + (d.allowed ? 0 : 1),
                used: d.used, limit: d.limit || 1,
                retry: d.allowed ? 0 : d.retry_after,
                hist: [...cur.hist, d.allowed].slice(-HISTORY),
              },
            };
          });
        })
        .catch(() => setConn("bad"));
    }
  }

  function burst(n) { for (let i = 0; i < n; i++) fireOnce(); }

  useEffect(() => {
    clearInterval(timerRef.current);
    if (auto && rate > 0) timerRef.current = setInterval(fireOnce, 1000 / rate);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, rate]);

  function resetAll() {
    fetch("/api/reset").then(() => setConn("ok")).catch(() => setConn("bad"));
    setState(freshState());
  }

  const pill =
    conn === "ok" ? ["pill pill-ok", "connected"]
    : conn === "bad" ? ["pill pill-bad", "offline"]
    : ["pill pill-wait", "ready"];

  return (
    <div className="cmp">
      {/* shared controls */}
      <div className="cmp-bar rise" style={{ "--d": "0ms" }}>
        <div className="cmp-bar-left">
          <label className="ctl cmp-key">
            <span>Key</span>
            <input defaultValue="compare-1" spellCheck={false}
              onChange={(e) => (keyRef.current = e.target.value)} />
          </label>
          <span className={pill[0]}>{pill[1]}</span>
        </div>
        <div className="cmp-bar-right">
          <button className="btn btn-primary" onClick={fireOnce}>Send to all ▶</button>
          <button className="btn" onClick={() => burst(10)}>Burst 10</button>
          <label className="ctl auto cmp-auto">
            <span>
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {" "}Auto <b>{rate}/s</b>
            </span>
            <input type="range" min="1" max="15" step="1" value={rate}
              onChange={(e) => setRate(Number(e.target.value))} />
          </label>
          <button className="btn btn-ghost" onClick={resetAll}>Reset</button>
        </div>
      </div>

      <p className="muted cmp-note rise" style={{ "--d": "60ms" }}>
        Every request goes to <b>all five algorithms at once</b> (each with its default parameters)
        — watch the same traffic get shaped five different ways.
      </p>

      {/* the five cards */}
      <div className="cmp-grid">
        {ALGOS.map((a, i) => {
          const s = state[a.id];
          const pct = Math.min(100, (s.used / (s.limit || 1)) * 100);
          const total = s.allowed + s.denied;
          return (
            <div className="cmp-card rise" style={{ "--d": `${120 + i * 70}ms` }} key={a.id}>
              <div className="cmp-card-head">
                <span className="cmp-ico">{a.icon}</span>
                <h4>{a.title}</h4>
              </div>

              <div className="cmp-gauge" title="current load toward the limit">
                <i style={{ width: `${pct.toFixed(1)}%` }}
                  className={pct >= 99 ? "full" : pct > 70 ? "warm" : ""} />
                <span className="cmp-gauge-label">{s.used.toFixed(1)} / {Math.round(s.limit)}</span>
              </div>

              <div className="cmp-nums">
                <span className="ok-txt">✓ {s.allowed}</span>
                <span className="bad-txt">✗ {s.denied}</span>
                <span className="muted">{total ? `${Math.round((s.allowed / total) * 100)}%` : "—"}</span>
              </div>

              <div className="cmp-dots">
                {s.hist.length === 0 && <span className="muted small">no traffic yet</span>}
                {s.hist.map((ok, j) => (
                  <i key={j} className={ok ? "ok" : "bad"} />
                ))}
              </div>

              <div className="cmp-retry">
                {s.retry > 0.05 ? `retry in ${s.retry.toFixed(1)}s` : " "}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
