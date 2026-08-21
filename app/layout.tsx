import type { Metadata } from "next";
import GoogleAdSense from "../components/GoogleAdSense";
import "./globals.css";

const base = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://clearlist-private-email-verifier.rafiq90.chatgpt.site");
const title = "Clearlist — Private email verification";
const description = "Understand email-list quality with transparent syntax, domain, MX, mailbox, disposable, role, and catch-all signals.";
const image = new URL("/og.png", base).href;
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Clearlist",
    url: base.href,
    description,
    inLanguage: "en",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Clearlist Email Verifier",
    url: base.href,
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript and a modern web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  },
];

export const metadata: Metadata = {
  metadataBase: base,
  title,
  description,
  applicationName: "Clearlist",
  authors: [{ name: "Clearlist", url: base }],
  creator: "Clearlist",
  publisher: "Clearlist",
  category: "Email deliverability and list quality",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/favicon-48x48.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  alternates: { canonical: base },
  openGraph: { title, description, type: "website", siteName: "Clearlist", locale: "en_US", url: base, images: [{ url: image, width: 1792, height: 928, alt: "Clearlist — A cleaner list. A clearer send." }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <GoogleAdSense />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
