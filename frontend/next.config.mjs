/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8080";

const nextConfig = {
  // Proxy all /api/* calls to the C++ backend so the browser talks to the Next
  // origin only — no CORS, no hard-coded backend host in the components.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
    ];
  },
};

export default nextConfig;
