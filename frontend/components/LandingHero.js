"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// A live, interactive token-bucket animation for the landing hero. Runs entirely
// client-side (no backend) so it's buttery smooth. Click anywhere / press the
// button to fire request packets and watch them get allowed or rejected.
const C = { ok: "#3fb950", bad: "#f85149", accent: "#cfd3da", muted: "#8b97a7", text: "#eef2f7" };

export default function LandingHero() {
  const [allowed, setAllowed] = useState(0);
  const [denied, setDenied] = useState(0);
  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: 1000, h: 560 });
  const stateRef = useRef({ tokens: 12, packets: [], last: 0, spawn: 0, drip: 0 });
  const CAP = 12, REFILL = 3;

  function fire(n = 1) {
    const { h } = sizeRef.current;
    for (let i = 0; i < n; i++) {
      stateRef.current.packets.push({
        x: 60, y: h * 0.5 + (Math.random() * 90 - 45),
        px: 60, py: h * 0.5, phase: "in", dec: null, alpha: 1,
      });
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let last = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
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
      draw(ctx);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function step(dt) {
    const s = stateRef.current;
    const { w, h } = sizeRef.current;
    const gateX = w * 0.52 - 70, serverX = w - 70;
    const cy = h * 0.5;

    s.tokens = Math.min(CAP, s.tokens + REFILL * dt);
    s.drip += dt;

    // auto traffic
    s.spawn += dt;
    if (s.spawn > 0.4) { s.spawn = 0; fire(1); }

    const speed = 360;
    for (const p of s.packets) {
      p.px = p.x; p.py = p.y;
      let tx, ty;
      if (p.phase === "in") { tx = gateX; ty = cy; }
      else if (p.phase === "out") { tx = serverX - 28; ty = cy; }
      else { tx = serverX - 28; ty = h - 46; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
      const stp = speed * dt;
      if (d <= stp) {
        p.x = tx; p.y = ty;
        if (p.phase === "in") {
          if (s.tokens >= 1) { s.tokens -= 1; p.phase = "out"; setAllowed((x) => x + 1); }
          else { p.phase = "rej"; setDenied((x) => x + 1); }
        } else p.done = true;
      } else { p.x += (dx / d) * stp; p.y += (dy / d) * stp; }
      if (p.done) p.alpha -= dt * 2.4;
    }
    s.packets = s.packets.filter((p) => p.alpha > 0);
    if (s.packets.length > 200) s.packets = s.packets.slice(-200); // hard cap
  }

  function draw(ctx) {
    const s = stateRef.current;
    const { w, h } = sizeRef.current;
    const cx = w * 0.52, cy = h * 0.5, gateX = cx - 70, serverX = w - 70;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // flow line
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, cy); ctx.lineTo(serverX - 28, cy); ctx.stroke();

    endpoint(ctx, 30, cy - 26, 58, 52, "Client", C.accent);
    endpoint(ctx, serverX - 28, cy - 26, 58, 52, "Server", C.ok);
    endpoint(ctx, serverX - 28, h - 70, 58, 46, "Denied", C.bad);

    // bucket
    const bw = 150, bh = 150, bx = cx - bw / 2, by = cy - bh / 2;
    // refill pipe + drip (only while the bucket actually has room)
    ctx.strokeStyle = C.ok; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx, by - 46); ctx.lineTo(cx, by - 6); ctx.stroke();
    if (s.tokens < CAP - 0.01) {
      const dy = by - 44 + ((s.drip * REFILL * 22) % 34);
      ctx.beginPath(); ctx.arc(cx, dy, 4, 0, 7); ctx.fillStyle = C.ok; ctx.fill();
    }

    roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = "rgba(255,255,255,0.02)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 2; ctx.stroke();

    // token dots
    const full = Math.floor(s.tokens + 1e-6), frac = s.tokens - full;
    const cols = 4, rows = 3, pad = 20, gap = 6;
    const cw = (bw - pad * 2) / cols, ch = (bh - pad * 2) / rows;
    const r = Math.max(6, Math.min(cw, ch) / 2 - gap);
    for (let i = 0; i < CAP; i++) {
      const col = i % cols, row = Math.floor(i / cols), vrow = rows - 1 - row;
      const tx = bx + pad + cw * col + cw / 2, ty = by + pad + ch * vrow + ch / 2;
      let a = i < full ? 1 : i === full ? frac : 0;
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7);
      ctx.fillStyle = `rgba(63,185,80,${0.12 + 0.82 * a})`; ctx.fill();
      if (a > 0.4) { ctx.strokeStyle = "rgba(63,185,80,0.4)"; ctx.lineWidth = 1; ctx.stroke(); }
    }

    // packets with trails
    for (const p of s.packets) {
      const col = p.phase === "out" ? C.ok : p.phase === "rej" ? C.bad : C.accent;
      ctx.globalAlpha = Math.max(0, p.alpha) * 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 7);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  function endpoint(ctx, x, y, wd, ht, text, color) {
    roundRect(ctx, x, y, wd, ht, 10);
    ctx.fillStyle = "rgba(28,34,48,0.7)"; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = color; ctx.font = "600 11px ui-sans-serif, system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, x + wd / 2, y + ht / 2);
  }
  function roundRect(ctx, x, y, wd, ht, rd) {
    rd = Math.min(rd, wd / 2, ht / 2);
    ctx.beginPath();
    ctx.moveTo(x + rd, y);
    ctx.arcTo(x + wd, y, x + wd, y + ht, rd);
    ctx.arcTo(x + wd, y + ht, x, y + ht, rd);
    ctx.arcTo(x, y + ht, x, y, rd);
    ctx.arcTo(x, y, x + wd, y, rd);
    ctx.closePath();
  }

  return (
    <div className="demo-card" onClick={() => fire(6)}>
      <canvas ref={canvasRef} className="demo-canvas" />
      <div className="demo-hud">
        <div className="demo-live">
          <span className="live-pill ok">✓ {allowed}</span>
          <span className="live-pill bad">✗ {denied}</span>
        </div>
        <div className="demo-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn fire" onClick={() => fire(12)}>⚡ Fire 12</button>
          <Link href="/simulator" className="btn btn-white">Open simulator →</Link>
        </div>
      </div>
      <span className="demo-hint">a live token bucket — click anywhere to fire requests</span>
    </div>
  );
}
