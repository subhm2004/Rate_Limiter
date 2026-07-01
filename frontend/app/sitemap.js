const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap() {
  return [
    { url: `${BASE}/`, lastModified: new Date(), priority: 1 },
    { url: `${BASE}/simulator`, lastModified: new Date(), priority: 0.9 },
    { url: `${BASE}/compare`, lastModified: new Date(), priority: 0.8 },
  ];
}
