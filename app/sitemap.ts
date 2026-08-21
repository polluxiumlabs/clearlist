import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://clearlist-private-email-verifier.rafiq90.chatgpt.site").replace(/\/$/, "");
  const routes = ["", "/guides", "/email-verification-guide", "/deliverability-guide", "/guides/email-bounces", "/guides/spf-dkim-dmarc", "/guides/catch-all-email", "/guides/role-based-email", "/about", "/contact", "/privacy", "/terms"];
  return routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date("2026-08-21"), changeFrequency: route ? "monthly" : "weekly", priority: route === "" ? 1 : route.includes("guide") ? .8 : .5 }));
}
