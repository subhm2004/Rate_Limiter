// Node.js (Express) backend. All rate-limiting decisions are made by the C++
// algorithms, loaded here as a native N-API addon (built from native/addon.cpp).
const express = require("express");

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
    res.json(rl.check(algo, key, cost));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/config", (req, res) => {
  try {
    const algo = String(req.query.algo || "");
    const p1 = parseFloat(req.query.p1);
    const p2 = parseFloat(req.query.p2);
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
