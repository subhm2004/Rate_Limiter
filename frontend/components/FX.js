"use client";

import { useEffect } from "react";

// Landing-page motion effects, all dependency-free:
//  - scroll-reveal for [data-reveal] sections (IntersectionObserver)
//  - count-up animation for [data-count] numbers
//  - a soft mouse-follow spotlight on the hero
// Renders nothing; it only wires up listeners. Reveal styles are scoped under
// html.fx so content stays visible if JS never runs.
export default function FX() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("fx");

    // scroll reveal
    const revealed = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    revealed.forEach((el) => io.observe(el));

    // count-up numbers
    const counters = document.querySelectorAll("[data-count]");
    const io2 = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io2.unobserve(e.target);
          const el = e.target;
          const target = parseFloat(el.dataset.count);
          const prefix = el.dataset.prefix || "";
          const suffix = el.dataset.suffix || "";
          const t0 = performance.now();
          const dur = 1100;
          const tick = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            const v = target * eased;
            el.textContent = prefix + (Number.isInteger(target) ? Math.round(v) : v.toFixed(1)) + suffix;
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => io2.observe(el));

    // hero spotlight follows the mouse
    const hero = document.querySelector(".vhero");
    const onMove = (ev) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      hero.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    hero?.addEventListener("mousemove", onMove);

    return () => {
      io.disconnect();
      io2.disconnect();
      hero?.removeEventListener("mousemove", onMove);
    };
  }, []);

  return null;
}
