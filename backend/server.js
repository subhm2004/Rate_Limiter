// Node.js (Express) backend. All rate-limiting decisions are made by the C++
// algorithms, loaded here as a native N-API addon (built from native/addon.cpp).
const express = require("express");
const fs = require("fs");
const path = require("path");

let rl;
try {
  rl = require("./build/Release/ratelimiter.node");
} catch (e) {
  console.error(
    "✖ Native addon not built. Run `npm install` (or `npm run build`) in backend/.\n  " +
      e.message
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8080;

// CORS so the Next.js dev server (or any origin) can call us directly too.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/api/meta", (req, res) => {
  res.json({ algorithms: rl.meta() });
});

app.get("/api/check", (req, res) => {
  try {
    const algo = String(req.query.algo || "");
    const key = String(req.query.key || "anon");
    const cost = Math.max(1, parseInt(req.query.cost, 10) || 1);
    const d = rl.check(algo, key, cost);
    // standard rate-limit headers, like a real public API
    res.set("X-RateLimit-Limit", String(Math.round(d.limit)));
    res.set("X-RateLimit-Remaining", String(Math.max(0, Math.floor(d.remaining))));
    if (!d.allowed && d.retry_after > 0)
      res.set("Retry-After", String(Math.max(1, Math.ceil(d.retry_after))));
    res.status(d.allowed ? 200 : 429).json(d);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// The actual C++ header implementing each algorithm (for the UI's source viewer).
const SOURCE_FILES = {
  token_bucket: "token_bucket.h",
  leaking_bucket: "leaking_bucket.h",
  fixed_window: "fixed_window.h",
  sliding_window_log: "sliding_window_log.h",
  sliding_window_counter: "sliding_window_counter.h",
};

// Strip C++ comments for display only — the files on disk keep them. String
// literals are respected so a "//" inside quotes survives.
function stripComments(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, ""); // block comments
  const out = [];
  for (const line of s.split("\n")) {
    let kept = "";
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        kept += ch;
        if (ch === "\\" && i + 1 < line.length) { kept += line[++i]; }
        else if (ch === '"') inStr = false;
      } else if (ch === '"') { inStr = true; kept += ch; }
      else if (ch === "/" && line[i + 1] === "/") break; // rest of line is a comment
      else kept += ch;
    }
    kept = kept.replace(/\s+$/, "");
    // drop lines that were pure comment (avoid leaving gaps everywhere)
    if (kept === "" && line.trim().startsWith("//")) continue;
    out.push(kept);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "");
}

app.get("/api/source", (req, res) => {
  const file = SOURCE_FILES[String(req.query.algo || "")];
  if (!file) return res.status(400).json({ error: "unknown algorithm" });
  try {
    const p = path.join(__dirname, "include", "rate_limiter", file);
    res.json({
      file: `backend/include/rate_limiter/${file}`,
      source: stripComments(fs.readFileSync(p, "utf8")),
    });
  } catch {
    res.status(500).json({ error: "source not available" });
  }
});

app.get("/api/config", (req, res) => {
  try {
    const algo = String(req.query.algo || "");
    const p1 = parseFloat(req.query.p1);
    const p2 = parseFloat(req.query.p2);
    // NaN slips past the C++ range checks (NaN comparisons are false),
    // leaving the limiter in a state that denies everything — reject it here.
    if (!Number.isFinite(p1) || !Number.isFinite(p2) || p1 <= 0 || p2 <= 0) {
      return res.status(400).json({ error: "p1 and p2 must be positive numbers" });
    }
    rl.config(algo, p1, p2);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/reset", (req, res) => {
  rl.reset();
  res.json({ ok: true });
});

// Friendly root: this port is the API; the UI is the Next.js app on :3000.
app.get("/", (req, res) => {
  res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8">
       <meta http-equiv="refresh" content="2;url=http://localhost:3000">
       <body style="font-family:system-ui;background:#0d1117;color:#e6edf3;display:flex;
       min-height:100vh;align-items:center;justify-content:center;margin:0">
       <div style="text-align:center">
       <h1>⏱️ Rate Limiter — API (Node + C++)</h1>
       <p>This is the API on :${PORT}. The UI is at
       <a style="color:#58a6ff" href="http://localhost:3000">http://localhost:3000</a> — redirecting…</p>
       </div></body>`
    );
});

app.listen(PORT, () => {
  console.log(`Rate limiter (Node + C++ addon) running:  http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});
