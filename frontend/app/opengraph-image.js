import { ImageResponse } from "next/og";

// Social share (Open Graph) card, generated at build time by next/og.
export const alt = "Rate Limiter — rate limiting, visualized";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <div
            style={{
              width: 92,
              height: 92,
              background: "#fff",
              color: "#0a0a0b",
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 72, fontWeight: 800 }}>RateLimiter</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#9aa2ae", marginTop: 30 }}>
          Rate limiting, visualized — live C++ engine
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 44, fontSize: 22, color: "#6f747d" }}>
          <span>C++</span><span>·</span><span>N-API</span><span>·</span>
          <span>Node.js</span><span>·</span><span>Next.js</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
