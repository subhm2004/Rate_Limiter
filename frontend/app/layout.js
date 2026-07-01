import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "Rate Limiter — rate limiting, visualized",
  description:
    "An interactive simulator for five classic rate-limiting algorithms. Real decisions from a thread-safe C++ engine, animated in a Next.js UI.",
  openGraph: {
    title: "Rate Limiter — rate limiting, visualized",
    description:
      "Five classic rate-limiting algorithms, animated in real time. Real decisions from a thread-safe C++ engine.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rate Limiter — rate limiting, visualized",
    description:
      "Five classic rate-limiting algorithms, animated in real time. Real decisions from a thread-safe C++ engine.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
