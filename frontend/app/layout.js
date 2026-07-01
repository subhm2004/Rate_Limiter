import "./globals.css";

export const metadata = {
  title: "Rate Limiter — rate limiting, visualized",
  description:
    "An interactive simulator for five classic rate-limiting algorithms. Real decisions from a thread-safe C++ engine, animated in a Next.js UI.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
