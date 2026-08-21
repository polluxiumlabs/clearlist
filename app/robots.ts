import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://clearlist-private-email-verifier.rafiq90.chatgpt.site").replace(/\/$/, "");
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, sitemap: `${base}/sitemap.xml`, host: base };
}
