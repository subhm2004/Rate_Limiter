"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Algorithm metadata (labels + defaults). The actual allow/deny decision always
// comes from the C++ backend; the mechanism drawn here is a live visualisation
// that snaps to the backend's reported state on every response.
// ---------------------------------------------------------------------------
const ALGOS = [
  { id: "token_bucket", title: "Token Bucket",
    blurb: "Tokens refill steadily; each request spends one. Empty bucket → rejected. Allows bursts up to capacity.",
    p1: { label: "Capacity", def: 10, min: 1, max: 30, step: 1 },
    p2: { label: "Refill /s", def: 2, min: 0.5, max: 15, step: 0.5 } },
  { id: "leaking_bucket", title: "Leaking Bucket",
    blurb: "Requests fill a bucket that leaks at a constant rate. Overflow → rejected. Smooths traffic into a steady stream.",
    p1: { label: "Capacity", def: 10, min: 1, max: 30, step: 1 },
    p2: { label: "Leak /s", def: 2, min: 0.5, max: 15, step: 0.5 } },
  { id: "fixed_window", title: "Fixed Window Counter",
    blurb: "Counts requests per fixed window; resets at each boundary. Cheap, but allows up to 2× at window edges.",
    p1: { label: "Limit", def: 10, min: 1, max: 30, step: 1 },
    p2: { label: "Window s", def: 5, min: 1, max: 15, step: 1 } },
  { id: "sliding_window_log", title: "Sliding Window Log",
    blurb: "Keeps a timestamp per request; old ones slide out of the window. Exact, no boundary burst.",
    p1: { label: "Limit", def: 10, min: 1, max: 30, step: 1 },
    p2: { label: "Window s", def: 5, min: 1, max: 15, step: 1 } },
  { id: "sliding_window_counter", title: "Sliding Window Counter",
    blurb: "Two counters (current + previous window), weighted by overlap. Near-exact at O(1) memory.",
    p1: { label: "Limit", def: 10, min: 1, max: 30, step: 1 },
    p2: { label: "Window s", def: 5, min: 1, max: 15, step: 1 } },
];

// Rich, per-algorithm explainer content shown under the simulator.
const EXPLAIN = {
  token_bucket: {
    tagline: "Burst-friendly throttling that still bounds your average rate.",
    how: [
      "A bucket holds up to capacity tokens and starts completely full.",
      "Tokens are added back steadily at the refill rate (tokens/second), never above capacity.",
      "Every incoming request must take one token to pass through the gate.",
      "If a token is available it is removed and the request is allowed.",
      "If the bucket is empty the request is rejected until enough time refills a token.",
    ],
    insight:
      "Because the bucket can sit full, a quiet client may spend a whole burst at once — yet over time the rate can never exceed the refill rate.",
    pros: ["Allows natural bursts (great UX)", "Bounds the long-run average", "O(1) memory & time per key"],
    cons: ["A burst can briefly exceed the steady rate", "Two knobs to tune (capacity + rate)"],
    bestFor: "General-purpose API limits where the occasional short burst is perfectly fine.",
    realWorld: "Stripe and AWS API Gateway use token-bucket style limits — e.g. “burst of 100, 10 req/s sustained.”",
  },
  leaking_bucket: {
    tagline: "Turns bursty traffic into a perfectly smooth, constant stream.",
    how: [
      "Requests pour into a queue (the bucket) of fixed capacity.",
      "The bucket leaks at a constant leak rate (requests/second), draining steadily.",
      "An arriving request is accepted only if there is still room in the bucket.",
      "If the bucket is full the request overflows and is rejected.",
      "Whatever is inside is released downstream at the steady leak rate.",
    ],
    insight:
      "The output rate is constant no matter how spiky the input is — the bucket absorbs jitter up to its capacity, then overflows.",
    pros: ["Perfectly smooth, constant output", "Shields fragile downstreams", "O(1) memory per key"],
    cons: ["Less forgiving of legitimate bursts", "Queuing adds latency to requests"],
    bestFor: "Shaping traffic for a downstream that needs a steady, predictable rate (a rate-limited DB or 3rd-party API).",
    realWorld: "NGINX’s limit_req directive uses a leaky-bucket algorithm to smooth out request bursts.",
  },
  fixed_window: {
    tagline: "The simplest counter — N requests per fixed block of time.",
    how: [
      "Time is split into fixed windows of length window seconds.",
      "Each window has a counter that starts at zero.",
      "Every request in the current window increments the counter.",
      "If the counter is still below the limit, the request is allowed.",
      "When the next window begins, the counter resets back to zero.",
    ],
    insight:
      "It is the cheapest limiter, but a client can send limit requests at the end of one window and limit again at the start of the next — up to 2× the limit across the boundary.",
    pros: ["Trivial to implement", "Tiny memory (a single counter)", "Very easy to reason about"],
    cons: ["Boundary burst: up to 2× near window edges", "Coarse, slightly unfair timing"],
    bestFor: "Coarse quotas where exactness doesn’t matter — e.g. “max 1000 calls per day.”",
    realWorld: "The classic “X requests per minute” counter, often built with Redis INCR + EXPIRE.",
  },
  sliding_window_log: {
    tagline: "Exact rate limiting by remembering every single request.",
    how: [
      "Keep a log of the timestamp of every allowed request.",
      "On each new request, drop all timestamps older than window seconds.",
      "Count what remains — those are the requests inside the rolling window.",
      "If the count is below the limit, accept and append the new timestamp.",
      "Otherwise reject; a slot frees up only when the oldest timestamp slides out.",
    ],
    insight:
      "Perfectly accurate over a true rolling window with no boundary burst — the trade-off is storing up to limit timestamps per key.",
    pros: ["Exact and fair", "No edge bursts at all", "Precise retry-after timing"],
    cons: ["O(limit) memory per key", "Costly at very high limits"],
    bestFor: "When correctness matters and limits are modest — login attempts, sensitive endpoints.",
    realWorld: "Often implemented with a Redis sorted set (ZADD + ZREMRANGEBYSCORE) for strict fairness.",
  },
  sliding_window_counter: {
    tagline: "Near-exact accuracy with O(1) memory — the practical sweet spot.",
    how: [
      "Keep just two counters: one for the current window, one for the previous.",
      "Measure how far you are into the current window (the overlap fraction).",
      "Weight the previous window’s count by how much of it still overlaps.",
      "Estimate = current count + previous × overlap fraction.",
      "Allow the request only if that estimate stays below the limit.",
    ],
    insight:
      "It approximates the exact sliding-window log using just two numbers — smoothing away the fixed-window boundary burst at constant memory.",
    formula: "estimated = current + previous × (1 − elapsed / window)",
    pros: ["Near-exact accuracy", "O(1) memory & time", "No boundary burst"],
    cons: ["An approximation (assumes even spread)", "Slightly off in pathological bursts"],
    bestFor: "High-scale production rate limiting — the default many real systems pick.",
    realWorld: "Cloudflare popularized this approach for rate limiting at the edge, at massive scale.",
  },
};

// palette (kept in JS so canvas can use the same colours as the CSS theme)
const C = {
  bg: "#0d1117", panel: "#161b22", panel2: "#1c2230", border: "#2a313c",
  text: "#e6edf3", muted: "#8b949e", accent: "#cfd3da",
  ok: "#3fb950", warn: "#d29922", bad: "#f85149", water: "#2f81f7",
};

// -------- small canvas helpers --------
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function label(ctx, text, x, y, color, size = 12, align = "center", weight = "600") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}
// a glowing circle or teardrop, used for refill / leak / consumed-token particles
function drop(ctx, x, y, r, color, tall) {
  ctx.beginPath();
  if (tall) ctx.ellipse(x, y, r * 0.72, r * 1.5, 0, 0, Math.PI * 2);
  else ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.fill();
  ctx.shadowBlur = 0;
}

export default function Simulator() {
  const [algoId, setAlgoId] = useState("token_bucket");
  const algo = ALGOS.find((a) => a.id === algoId);

  const [p1, setP1] = useState(algo.p1.def);
  const [p2, setP2] = useState(algo.p2.def);
  const [keyName, setKeyName] = useState("user-1");
  const [auto, setAuto] = useState(false);
  const [autoRate, setAutoRate] = useState(3);
  const [allowed, setAllowed] = useState(0);
  const [denied, setDenied] = useState(0);
  const [feed, setFeed] = useState([]); // [{id, ok}]
  const [conn, setConn] = useState("wait");
  const [latency, setLatency] = useState(null); // last round-trip ms to the C++ backend
  const [preset, setPreset] = useState(null);   // active traffic preset
  const [cost, setCost] = useState(1);          // cost-weighted: units per request

  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: 800, h: 480 });
  const cfgRef = useRef({ algoId, p1, p2, key: keyName });
  const mechRef = useRef(null);
  const packetsRef = useRef([]);
  const pulsesRef = useRef([]);
  const idRef = useRef(0);
  const autoTimerRef = useRef(null);
  const cfgTimerRef = useRef(null);
  // live throughput chart
  const chartRef = useRef(null);
  const chartSizeRef = useRef({ w: 800, h: 160 });
  const secRef = useRef({ a: 0, d: 0 });   // counts in the current second
  const historyRef = useRef([]);           // [{a, d}] per past second
  const presetTimerRef = useRef([]);       // active preset interval ids
  const costRef = useRef(1);               // latest cost, read by timers

  // ---- keep a ref of the live config so the rAF loop / timers read latest ----
  useEffect(() => {
    cfgRef.current = { algoId, p1: Number(p1), p2: Number(p2), key: keyName };
  }, [algoId, p1, p2, keyName]);
  useEffect(() => { costRef.current = cost; }, [cost]);

  // ---- build the mechanism state for the current algorithm ----
  function resetMech() {
    const a = Number(p1), b = Number(p2);
    mechRef.current = {
      tokens: a,            // token bucket
      level: 0,             // leaking bucket
      count: 0, used: 0,    // windows (displayed)
      winTimer: b,          // time left in current window
      cur: 0, prev: 0,      // sliding counter
      countDisp: 0, curDisp: 0, prevDisp: 0, // eased display values for smooth bars
      ticks: [],            // sliding log (absolute seconds)
      flash: 0,             // window-reset flash timer
      parts: [],            // particles: refill drops, leak drops, consumed tokens
      refillAcc: 0, leakAcc: 0, // spawn accumulators (rate-based)
    };
    packetsRef.current = [];
    pulsesRef.current = [];
  }

  // ---- sync params/algo to the backend + reset the visual ----
  useEffect(() => {
    resetMech();
    clearTimeout(cfgTimerRef.current);
    cfgTimerRef.current = setTimeout(() => {
      fetch(`/api/config?algo=${algoId}&p1=${Number(p1)}&p2=${Number(p2)}`)
        .then(() => setConn("ok"))
        .catch(() => setConn("bad"));
    }, 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algoId, p1, p2]);

  function switchAlgo(id) {
    const a = ALGOS.find((x) => x.id === id);
    clearPreset();
    setAlgoId(id);
    setP1(a.p1.def);
    setP2(a.p2.def);
    setAllowed(0); setDenied(0); setFeed([]); setLatency(null);
    historyRef.current = []; secRef.current = { a: 0, d: 0 };
  }

  // ---- send one request (decision comes from the C++ backend) ----
  function send() {
    const c = cfgRef.current;
    const { h } = sizeRef.current;
    const p = {
      id: idRef.current++,
      x: 64,
      y: h * 0.52 + (Math.random() * 44 - 22),
      phase: "in",
      dec: null,
      alpha: 1,
    };
    packetsRef.current.push(p);

    const key = encodeURIComponent(c.key || "anon");
    const t0 = performance.now();
    fetch(`/api/check?algo=${c.algoId}&key=${key}&cost=${costRef.current}`)
      .then((r) => r.json())
      .then((d) => {
        setLatency(Math.round((performance.now() - t0) * 10) / 10);
        p.dec = d;
        applySnap(c.algoId, d);
        if (d.allowed) { setAllowed((x) => x + 1); secRef.current.a++; }
        else { setDenied((x) => x + 1); secRef.current.d++; }
        setFeed((f) => [{ id: p.id, ok: d.allowed }, ...f].slice(0, 10));
        setConn("ok");
      })
      .catch(() => {
        p.dec = { allowed: false, used: 0, limit: 1, remaining: 0, retry_after: 0 };
        setConn("bad");
      });
  }

  // snap the visual mechanism to the backend's authoritative numbers
  function applySnap(id, d) {
    const m = mechRef.current;
    if (!m) return;
    const { w, h } = sizeRef.current;
    const cx = w * 0.46, cy = h * 0.52, limiterX = w * 0.46 - 70;
    if (id === "token_bucket") {
      m.tokens = d.remaining;
      if (d.allowed) {
        // a token leaves the bucket and flies to the gate to be "spent"
        m.parts.push({ type: "consume", x: cx, y: cy - 30, tx: limiterX, ty: cy,
          r: 7, life: 5, color: C.ok });
      }
    } else if (id === "leaking_bucket") {
      m.level = d.used;
      if (d.allowed) {
        // accepted request pours a drop of water into the bucket from the top
        const lby = cy - 74;
        m.parts.push({ type: "inflow", x: cx + (Math.random() * 10 - 5), y: lby - 30,
          vx: 0, vy: 80, g: 300, r: 4.5, life: 4, landY: lby + 12, color: C.water });
      }
    } else if (id === "fixed_window") {
      m.count = d.used;
      if (d.allowed)
        m.parts.push({ type: "refill", x: cx - 30, y: cy - 120, vx: 0, vy: 90, g: 320,
          r: 5, life: 4, landY: cy - 92, color: C.ok });
    } else if (id === "sliding_window_counter") {
      m.used = d.used;
      if (d.allowed) {
        m.cur += 1;
        const bw = 70, gap = 40, baseX = cx - bw - gap / 2 - 10;
        const curX = baseX + bw + gap + bw / 2;
        m.parts.push({ type: "refill", x: curX, y: cy - 110, vx: 0, vy: 90, g: 320,
          r: 5, life: 4, landY: cy - 70, color: C.ok });
      }
    } else if (id === "sliding_window_log") {
      m.used = d.used;
      if (d.allowed) {
        m.ticks.push(performance.now() / 1000);
        const trackW = Math.min(360, w * 0.5);
        const nowX = cx + trackW / 2 + 30;
        m.parts.push({ type: "refill", x: nowX, y: cy - 60, vx: 0, vy: 90, g: 320,
          r: 5, life: 4, landY: cy - 30, color: C.ok });
      }
    }
  }

  // ---- auto traffic ----
  useEffect(() => {
    clearInterval(autoTimerRef.current);
    if (auto && autoRate > 0) {
      autoTimerRef.current = setInterval(send, 1000 / autoRate);
    }
    return () => clearInterval(autoTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, autoRate]);

  // ---- traffic presets ----
  function clearPresetTimers() {
    presetTimerRef.current.forEach(clearInterval);
    presetTimerRef.current = [];
  }
  function clearPreset() {
    clearPresetTimers();
    setPreset(null);
  }
  function startPreset(name) {
    clearPresetTimers();
    setAuto(false);
    setPreset(name);
    if (name === "steady") {
      presetTimerRef.current.push(setInterval(send, 120)); // ~8/s constant
    } else if (name === "bursty") {
      presetTimerRef.current.push(setInterval(() => { for (let i = 0; i < 12; i++) send(); }, 1600));
    } else if (name === "spike") {
      let tick = 0;
      presetTimerRef.current.push(setInterval(() => {
        tick = (tick + 1) % 120;        // 120 × 50ms = 6s cycle
        if (tick >= 84) send();         // last ~1.8s = heavy spike (~20/s)
        else if (tick % 8 === 0) send();// calm baseline (~2.5/s)
      }, 50));
    }
  }

  function resetAll() {
    fetch("/api/reset").then(() => setConn("ok")).catch(() => setConn("bad"));
    clearPreset();
    resetMech();
    setAllowed(0); setDenied(0); setFeed([]); setLatency(null);
    historyRef.current = []; secRef.current = { a: 0, d: 0 };
  }

  // roll the per-second throughput buckets once a second
  useEffect(() => {
    const id = setInterval(() => {
      historyRef.current.push({ a: secRef.current.a, d: secRef.current.d });
      if (historyRef.current.length > 40) historyRef.current.shift();
      secRef.current = { a: 0, d: 0 };
    }, 1000);
    return () => { clearInterval(id); clearPresetTimers(); };
  }, []);

  // ---- the animation loop ----
  useEffect(() => {
    resetMech();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let last = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sizeRef.current = { w, h };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      render(ctx);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- live throughput chart (its own loop) ----
  useEffect(() => {
    const cv = chartRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let raf = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      chartSizeRef.current = { w, h };
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    function frame() { drawChart(ctx); raf = requestAnimationFrame(frame); }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drawChart(ctx) {
    const { w, h } = chartSizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const N = 40;
    const live = { a: secRef.current.a, d: secRef.current.d };
    let pts = historyRef.current.concat([live]);
    if (pts.length < N) pts = Array(N - pts.length).fill({ a: 0, d: 0 }).concat(pts);
    pts = pts.slice(-N);
    const maxV = Math.max(5, ...pts.map((p) => Math.max(p.a, p.d)));
    const padL = 30, padR = 10, padT = 12, padB = 18;
    const cw = w - padL - padR, ch = h - padT - padB;
    const xAt = (i) => padL + cw * (i / (N - 1));
    const yAt = (v) => padT + ch * (1 - v / maxV);

    // grid + y labels
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.fillStyle = C.muted;
    ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let g = 0; g <= 2; g++) {
      const v = (maxV / 2) * g;
      const y = yAt(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(String(Math.round(v)), padL - 6, y);
    }

    function series(key, color, fill) {
      ctx.beginPath();
      pts.forEach((p, i) => { const x = xAt(i), y = yAt(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (fill) {
        ctx.lineTo(xAt(N - 1), yAt(0)); ctx.lineTo(xAt(0), yAt(0)); ctx.closePath();
        const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
        grad.addColorStop(0, fill); grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath();
        pts.forEach((p, i) => { const x = xAt(i), y = yAt(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
    }
    series("a", C.ok, "rgba(63,185,80,0.22)");
    series("d", C.bad, null);
  }

  // ---- per-frame state update ----
  function step(dt) {
    const c = cfgRef.current;
    const m = mechRef.current;
    if (!m) return;
    const a = Number(c.p1), b = Number(c.p2);
    const { w, h } = sizeRef.current;
    const cx = w * 0.46;
    const cy = h * 0.52;
    const limiterX = w * 0.46 - 70;
    const serverX = w - 64;

    // mechanism continuous motion
    if (c.algoId === "token_bucket") {
      m.tokens = Math.min(a, m.tokens + b * dt);
      // steady stream of token drops falling from the refill pipe into the bucket
      const by = cy - 65;
      if (m.tokens < a - 0.001) {
        m.refillAcc += b * dt;
        while (m.refillAcc >= 1) {
          m.refillAcc -= 1;
          m.parts.push({ type: "refill", x: cx + (Math.random() * 10 - 5), y: by - 40,
            vx: 0, vy: 70, g: 280, r: 4.5, life: 5, landY: by + 24, color: C.ok });
        }
      } else m.refillAcc = 0;
    } else if (c.algoId === "leaking_bucket") {
      m.level = Math.max(0, m.level - b * dt);
      // steady stream of drops leaking out of the hole at the bottom
      const holeY = cy - 74 + 160 - 2;
      if (m.level > 0.02) {
        m.leakAcc += b * dt;
        while (m.leakAcc >= 1) {
          m.leakAcc -= 1;
          m.parts.push({ type: "leak", x: cx + (Math.random() * 6 - 3), y: holeY,
            vx: 0, vy: 35, g: 320, r: 4, life: 1.8, endY: h - 36, color: C.water });
        }
      } else m.leakAcc = 0;
    } else if (c.algoId === "fixed_window") {
      m.winTimer -= dt;
      if (m.winTimer <= 0) { m.winTimer += b; m.count = 0; m.flash = 1; }
    } else if (c.algoId === "sliding_window_counter") {
      m.winTimer -= dt;
      if (m.winTimer <= 0) { m.winTimer += b; m.prev = m.cur; m.cur = 0; }
    } else if (c.algoId === "sliding_window_log") {
      const tnow = performance.now() / 1000;
      m.ticks = m.ticks.filter((t) => tnow - t <= b);
    }
    if (m.flash > 0) m.flash = Math.max(0, m.flash - dt * 2);

    // ease the displayed bar values toward their targets for smooth motion
    const ease = Math.min(1, dt * 10);
    m.countDisp += (m.count - m.countDisp) * ease;
    m.curDisp += (m.cur - m.curDisp) * ease;
    m.prevDisp += (m.prev - m.prevDisp) * ease;

    // particles: refill drops, leak drops, water inflow, consumed tokens
    for (const pt of m.parts) {
      if (pt.type === "consume") {
        const dx = pt.tx - pt.x, dy = pt.ty - pt.y, d = Math.hypot(dx, dy) || 1;
        const s = 460 * dt;
        if (d <= s) pt.dead = true;
        else { pt.x += (dx / d) * s; pt.y += (dy / d) * s; }
      } else {
        pt.vy += pt.g * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if ((pt.type === "refill" || pt.type === "inflow") && pt.y >= pt.landY) {
          pt.dead = true; // splash where it lands
          pulsesRef.current.push({ x: pt.x, y: pt.landY, r: 2, alpha: 0.5, ok: pt.type === "refill" });
        }
        if (pt.type === "leak" && (pt.y > pt.endY || pt.life <= 0)) pt.dead = true;
      }
    }
    m.parts = m.parts.filter((p) => !p.dead);

    // packets
    const speed = 320;
    for (const p of packetsRef.current) {
      let tx, ty;
      if (p.phase === "in") { tx = limiterX; ty = cy; }
      else if (p.phase === "out") { tx = serverX - 26; ty = cy; }
      else { tx = serverX - 26; ty = h - 44; } // reject bin
      const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy) || 1;
      const stepLen = speed * dt;
      if (dist <= stepLen) {
        p.x = tx; p.y = ty;
        if (p.phase === "in") {
          if (p.dec) {
            p.phase = p.dec.allowed ? "out" : "rej";
            pulsesRef.current.push({ x: limiterX, y: cy, r: 6, alpha: 0.9, ok: p.dec.allowed });
          }
          // else: wait at the gate until the decision arrives
        } else {
          p.arrived = true;
        }
      } else {
        p.x += (dx / dist) * stepLen;
        p.y += (dy / dist) * stepLen;
      }
      if (p.arrived) p.alpha -= dt * 2.2;
    }
    packetsRef.current = packetsRef.current.filter((p) => p.alpha > 0);

    // pulses
    for (const pu of pulsesRef.current) { pu.r += dt * 90; pu.alpha -= dt * 1.6; }
    pulsesRef.current = pulsesRef.current.filter((pu) => pu.alpha > 0);
  }

  // ---- render everything ----
  function render(ctx) {
    const c = cfgRef.current;
    const m = mechRef.current;
    const { w, h } = sizeRef.current;
    if (!m) return;
    const cy = h * 0.52;
    const limiterX = w * 0.46 - 70;
    const serverX = w - 64;

    ctx.clearRect(0, 0, w, h);

    // subtle grid background
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // flow line client -> gate -> server
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, cy); ctx.lineTo(serverX - 26, cy); ctx.stroke();

    // client box
    drawEndpoint(ctx, 30, cy - 26, 64, 52, "Client", C.accent);
    // server box (allowed)
    drawEndpoint(ctx, serverX - 24, cy - 26, 64, 52, "Server", C.ok);
    // reject bin
    drawEndpoint(ctx, serverX - 24, h - 70, 64, 46, "Rejected", C.bad);

    // algorithm mechanism
    const cx = w * 0.46;
    if (c.algoId === "token_bucket") drawTokenBucket(ctx, m, c, cx, cy);
    else if (c.algoId === "leaking_bucket") drawLeakingBucket(ctx, m, c, cx, cy);
    else if (c.algoId === "fixed_window") drawFixedWindow(ctx, m, c, cx, cy, w, h);
    else if (c.algoId === "sliding_window_log") drawSlidingLog(ctx, m, c, cx, cy, w, h);
    else if (c.algoId === "sliding_window_counter") drawSlidingCounter(ctx, m, c, cx, cy, w, h);

    // particles (refill / leak / inflow / consumed-token)
    for (const pt of m.parts) {
      ctx.globalAlpha = pt.type === "leak" ? Math.max(0, Math.min(1, pt.life * 1.3)) : 1;
      drop(ctx, pt.x, pt.y, pt.r, pt.color, pt.type !== "consume");
      ctx.globalAlpha = 1;
    }

    // pulses
    for (const pu of pulsesRef.current) {
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.r, 0, Math.PI * 2);
      ctx.strokeStyle = (pu.ok ? "rgba(63,185,80," : "rgba(248,81,73,") + pu.alpha + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // packets
    for (const p of packetsRef.current) {
      const color = p.phase === "out" ? C.ok : p.phase === "rej" ? C.bad : C.accent;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // -------- endpoint helper --------
  function drawEndpoint(ctx, x, y, wd, ht, text, color) {
    roundRect(ctx, x, y, wd, ht, 10);
    ctx.fillStyle = C.panel2;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    label(ctx, text, x + wd / 2, y + ht / 2, color, 12);
  }

  // -------- 1. token bucket --------
  function drawTokenBucket(ctx, m, c, cx, cy) {
    const a = Number(c.p1);
    const bw = 150, bh = 150, bx = cx - bw / 2, by = cy - bh / 2 + 10;
    // refill pipe (the actual falling drops are particles drawn separately)
    ctx.strokeStyle = C.ok; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx, by - 52); ctx.lineTo(cx, by - 6); ctx.stroke();
    ctx.fillStyle = C.ok;
    ctx.beginPath(); ctx.arc(cx, by - 6, 5, 0, Math.PI * 2); ctx.fill(); // pipe mouth
    label(ctx, "refill", cx, by - 62, C.ok, 11);

    // bucket
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();

    // token dots in a grid
    const full = Math.floor(m.tokens + 1e-6);
    const frac = m.tokens - full;
    const cols = Math.ceil(Math.sqrt(a));
    const rows = Math.ceil(a / cols);
    const pad = 16, gap = 6;
    const cellW = (bw - pad * 2) / cols, cellH = (bh - pad * 2) / rows;
    const rad = Math.max(4, Math.min(cellW, cellH) / 2 - gap);
    for (let i = 0; i < a; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      // fill from the bottom up
      const visualRow = rows - 1 - row;
      const tx = bx + pad + cellW * col + cellW / 2;
      const ty = by + pad + cellH * visualRow + cellH / 2;
      let alpha = 0;
      if (i < full) alpha = 1;
      else if (i === full) alpha = frac;
      ctx.beginPath(); ctx.arc(tx, ty, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(63,185,80,${0.18 + 0.82 * alpha})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(63,185,80,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    }
    label(ctx, `${m.tokens.toFixed(1)} / ${a} tokens`, cx, by + bh + 18, C.text, 13);
    label(ctx, `refills ${c.p2}/s`, cx, by + bh + 36, C.muted, 11);
  }

  // -------- 2. leaking bucket --------
  function drawLeakingBucket(ctx, m, c, cx, cy) {
    const a = Number(c.p1);
    const bw = 130, bh = 160, bx = cx - bw / 2, by = cy - bh / 2 + 6;
    // bucket outline
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();
    // water
    const ratio = Math.max(0, Math.min(1, m.level / a));
    const wH = (bh - 6) * ratio;
    const wy = by + bh - 3 - wH;
    ctx.save();
    roundRect(ctx, bx + 3, by + 3, bw - 6, bh - 6, 8); ctx.clip();
    const grad = ctx.createLinearGradient(0, wy, 0, by + bh);
    grad.addColorStop(0, "#3b8eea"); grad.addColorStop(1, "#1f6feb");
    ctx.fillStyle = grad;
    ctx.fillRect(bx + 3, wy, bw - 6, wH + 4);
    // wavy top
    ctx.beginPath();
    ctx.moveTo(bx + 3, wy);
    const t = performance.now() / 350;
    for (let x = 0; x <= bw - 6; x += 6) {
      ctx.lineTo(bx + 3 + x, wy + Math.sin(x / 14 + t) * 3);
    }
    ctx.lineTo(bx + bw - 3, by + bh); ctx.lineTo(bx + 3, by + bh); ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
    ctx.restore();
    // leak spout at the bottom (the falling drops are particles drawn separately)
    ctx.fillStyle = C.panel2;
    roundRect(ctx, cx - 7, by + bh - 2, 14, 8, 2); ctx.fill();
    ctx.strokeStyle = C.water; ctx.lineWidth = 1.5; ctx.stroke();
    label(ctx, "leak", cx + 26, by + bh + 8, C.water, 11);
    label(ctx, `${m.level.toFixed(1)} / ${a} queued`, cx, by - 14, C.text, 13);
    label(ctx, `leaks ${c.p2}/s`, cx, by + bh + 48, C.muted, 11);
  }

  // -------- 3. fixed window --------
  function drawFixedWindow(ctx, m, c, cx, cy) {
    const limit = Number(c.p1), win = Number(c.p2);
    const bw = 90, bh = 180, bx = cx - bw / 2 - 30, by = cy - bh / 2;
    // counter column
    roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();
    const ratio = Math.min(1, m.countDisp / limit);
    const fillH = (bh - 6) * ratio;
    ctx.save(); roundRect(ctx, bx + 3, by + 3, bw - 6, bh - 6, 6); ctx.clip();
    ctx.fillStyle = m.count >= limit ? C.bad : ratio > 0.7 ? C.warn : C.ok;
    ctx.fillRect(bx + 3, by + bh - 3 - fillH, bw - 6, fillH + 3);
    ctx.restore();
    if (m.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${m.flash * 0.35})`;
      roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
    }
    label(ctx, `${m.count} / ${limit}`, bx + bw / 2, by - 16, C.text, 14);

    // window progress dial
    const dx = cx + 70, dy = cy, R = 46;
    const prog = 1 - m.winTimer / win;
    ctx.beginPath(); ctx.arc(dx, dy, R, 0, Math.PI * 2);
    ctx.strokeStyle = C.border; ctx.lineWidth = 8; ctx.stroke();
    ctx.beginPath(); ctx.arc(dx, dy, R, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 8; ctx.stroke();
    label(ctx, `${m.winTimer.toFixed(1)}s`, dx, dy - 4, C.text, 15);
    label(ctx, "to reset", dx, dy + 14, C.muted, 10);
    label(ctx, `window ${win}s`, cx + 20, by + bh + 6, C.muted, 11);
  }

  // -------- 4. sliding window log --------
  function drawSlidingLog(ctx, m, c, cx, cy, w) {
    const limit = Number(c.p1), win = Number(c.p2);
    const trackW = Math.min(360, w * 0.5), trackH = 60;
    const tx = cx - trackW / 2 + 30, ty = cy - trackH / 2;
    // track
    roundRect(ctx, tx, ty, trackW, trackH, 8);
    ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
    ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();
    // window region (full track = exactly `window` seconds, now at right edge)
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(tx, ty, trackW, trackH);
    label(ctx, "now", tx + trackW, ty - 12, C.accent, 11, "center");
    label(ctx, `-${win}s`, tx, ty - 12, C.muted, 11, "center");
    // ticks — fade as they age toward the left edge (about to slide out)
    const tnow = performance.now() / 1000;
    const over = m.ticks.length >= limit;
    for (const t of m.ticks) {
      const age = tnow - t; // 0..win
      const x = tx + trackW * (1 - age / win);
      ctx.globalAlpha = Math.max(0.18, 1 - (age / win) * 0.8);
      ctx.strokeStyle = over ? C.warn : C.ok; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, ty + 6); ctx.lineTo(x, ty + trackH - 6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const count = m.ticks.length;
    label(ctx, `${count} / ${limit} in window`, cx + 30, ty + trackH + 22,
      count >= limit ? C.bad : C.text, 13);
  }

  // -------- 5. sliding window counter --------
  function drawSlidingCounter(ctx, m, c, cx, cy) {
    const limit = Number(c.p1), win = Number(c.p2);
    const weight = Math.max(0, m.winTimer / win); // previous window's remaining overlap
    const est = m.cur + m.prev * weight;
    const bw = 70, bh = 150, gap = 40;
    const baseX = cx - bw - gap / 2 - 10, baseY = cy - bh / 2;

    function frame(x, title) {
      roundRect(ctx, x, baseY, bw, bh, 8);
      ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
      ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();
      label(ctx, title, x + bw / 2, baseY - 16, C.muted, 11);
    }
    function fill(x, ratio, color, alpha) {
      const fh = (bh - 6) * Math.min(1, Math.max(0, ratio));
      ctx.save(); roundRect(ctx, x + 3, baseY + 3, bw - 6, bh - 6, 6); ctx.clip();
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.fillRect(x + 3, baseY + bh - 3 - fh, bw - 6, fh + 3);
      ctx.globalAlpha = 1; ctx.restore();
    }

    // previous window: full bar faded (sliding out), the weighted bottom part bright (still counts)
    const prevX = baseX;
    frame(prevX, `prev ×${weight.toFixed(2)}`);
    fill(prevX, m.prevDisp / limit, C.accent, 0.25);
    fill(prevX, (m.prevDisp * weight) / limit, C.accent, 0.95);
    label(ctx, `${Math.round(m.prev)}`, prevX + bw / 2, baseY + bh + 16, C.text, 12);

    // current window
    const curX = baseX + bw + gap;
    frame(curX, "current");
    fill(curX, m.curDisp / limit, C.ok, 1);
    label(ctx, `${m.cur}`, curX + bw / 2, baseY + bh + 16, C.text, 12);

    // estimate readout
    const ex = curX + bw + 56;
    label(ctx, "estimated", ex, cy - 24, C.muted, 11);
    label(ctx, `${est.toFixed(1)}`, ex, cy, est >= limit ? C.bad : C.text, 26);
    label(ctx, `/ ${limit}`, ex, cy + 24, C.muted, 12);
  }

  const connPill =
    conn === "ok" ? ["pill pill-ok", "connected"]
    : conn === "bad" ? ["pill pill-bad", "offline"]
    : ["pill pill-wait", "connecting…"];

  return (
    <div className="sim">
      {/* algorithm tabs */}
      <div className="seg">
        {ALGOS.map((a) => (
          <button
            key={a.id}
            className={`seg-btn ${a.id === algoId ? "active" : ""}`}
            onClick={() => switchAlgo(a.id)}
          >
            {a.title}
          </button>
        ))}
      </div>

      <p className="blurb">{algo.blurb}</p>

      <div className="sim-grid">
        {/* stage */}
        <div className="stage">
          <canvas ref={canvasRef} className="canvas" />
        </div>

        {/* side panel */}
        <aside className="panel">
          <div className="row">
            <span className="muted">Status</span>
            <span className={connPill[0]}>{connPill[1]}</span>
          </div>

          <label className="ctl">
            <span>Key</span>
            <input value={keyName} onChange={(e) => setKeyName(e.target.value)} spellCheck={false} />
          </label>

          <label className="ctl">
            <span>{algo.p1.label}: <b>{p1}</b></span>
            <input type="range" min={algo.p1.min} max={algo.p1.max} step={algo.p1.step}
              value={p1} onChange={(e) => setP1(e.target.value)} />
          </label>

          <label className="ctl">
            <span>{algo.p2.label}: <b>{p2}</b></span>
            <input type="range" min={algo.p2.min} max={algo.p2.max} step={algo.p2.step}
              value={p2} onChange={(e) => setP2(e.target.value)} />
          </label>

          <label className="ctl">
            <span>Cost / request: <b>{cost}</b> {cost > 1 && <span className="muted">(heavy)</span>}</span>
            <input type="range" min="1" max="5" step="1" value={cost}
              onChange={(e) => setCost(Number(e.target.value))} />
          </label>

          <div className="stats2">
            <div className="stat ok"><span>Allowed</span><b>{allowed}</b></div>
            <div className="stat bad"><span>Denied</span><b>{denied}</b></div>
          </div>

          <div className="badge" title="Round-trip time of the last request to the C++ backend">
            <span className="live-dot" />
            {latency == null ? "served by C++" : <>served by C++ in <b>{latency} ms</b></>}
          </div>

          <div className="feed">
            {feed.length === 0 && <span className="muted small">no requests yet</span>}
            {feed.map((f) => (
              <span key={f.id} className={`chip ${f.ok ? "ok" : "bad"}`}>
                {f.ok ? "✓ allowed" : "✗ denied"}
              </span>
            ))}
          </div>

          <div className="btns">
            <button className="btn btn-primary big" onClick={send}>Send request ▶</button>
            <button className="btn" onClick={() => { for (let i = 0; i < 10; i++) send(); }}>Burst 10</button>
          </div>

          <label className="ctl auto">
            <span>
              <input type="checkbox" checked={auto}
                onChange={(e) => { if (e.target.checked) clearPreset(); setAuto(e.target.checked); }} />
              {" "}Auto traffic: <b>{autoRate}/s</b>
            </span>
            <input type="range" min="1" max="20" step="1" value={autoRate}
              onChange={(e) => setAutoRate(Number(e.target.value))} />
          </label>

          <div className="presets">
            <span className="ctl-label">Traffic presets</span>
            <div className="preset-row">
              <button className={`preset-btn ${preset === "steady" ? "active" : ""}`}
                onClick={() => startPreset("steady")}>🚶 Steady</button>
              <button className={`preset-btn ${preset === "bursty" ? "active" : ""}`}
                onClick={() => startPreset("bursty")}>💥 Bursty</button>
              <button className={`preset-btn ${preset === "spike" ? "active" : ""}`}
                onClick={() => startPreset("spike")}>🔥 DDoS spike</button>
              <button className="preset-btn stop" onClick={clearPreset}>⏹ Stop</button>
            </div>
          </div>

          <button className="btn btn-ghost" onClick={resetAll}>Reset all</button>
        </aside>
      </div>

      {/* ---- live throughput chart ---- */}
      <section className="metrics">
        <div className="metrics-head">
          <h3>Live throughput</h3>
          <div className="legend">
            <span><i className="lg ok" /> allowed</span>
            <span><i className="lg bad" /> denied</span>
            <span className="muted">requests / second · last 40s</span>
          </div>
        </div>
        <canvas ref={chartRef} className="chart" />
      </section>

      {/* ---- premium per-algorithm explainer ---- */}
      <Explainer algoId={algoId} title={algo.title}
        index={ALGOS.findIndex((a) => a.id === algoId) + 1} />
    </div>
  );
}

// Detailed write-up for the currently selected algorithm.
function Explainer({ algoId, title, index }) {
  const ex = EXPLAIN[algoId];
  if (!ex) return null;
  return (
    <section className="explain">
      <div className="explain-head">
        <span className="ex-badge">{index}</span>
        <div>
          <h3>{title}</h3>
          <p className="ex-tag">{ex.tagline}</p>
        </div>
      </div>

      <div className="explain-grid">
        <div className="ex-card ex-how">
          <h4>⚙️ How it works</h4>
          <ol>
            {ex.how.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        <div className="ex-side">
          <div className="ex-card ex-key">
            <h4>💡 Key insight</h4>
            <p>{ex.insight}</p>
            {ex.formula && <code className="formula">{ex.formula}</code>}
          </div>

          <div className="ex-card ex-pc">
            <div className="pc-col pros">
              <h4>Pros</h4>
              <ul>{ex.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
            <div className="pc-col cons">
              <h4>Cons</h4>
              <ul>{ex.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          </div>

          <div className="ex-card ex-use">
            <p><span className="ex-emoji">🎯</span> <b>Best for</b> — {ex.bestFor}</p>
            <p><span className="ex-emoji">🌍</span> <b>In the wild</b> — {ex.realWorld}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
