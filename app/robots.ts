import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://clearlist.example";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, sitemap: `${base.replace(/\/$/, "")}/sitemap.xml` };
}
