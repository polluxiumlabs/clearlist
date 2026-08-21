import type { Metadata } from "next";
import GoogleAdSense from "../components/GoogleAdSense";
import "./globals.css";

const base = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://clearlist-private-email-verifier.rafiq90.chatgpt.site");
const title = "Clearlist — Private email verification";
const description = "Understand email-list quality with transparent syntax, domain, MX, mailbox, disposable, role, and catch-all signals.";
const image = new URL("/og.png", base).href;

export const metadata: Metadata = {
  metadataBase: base,
  title,
  description,
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  alternates: { canonical: base },
  openGraph: { title, description, type: "website", siteName: "Clearlist", url: base, images: [{ url: image, width: 1792, height: 928, alt: "Clearlist — A cleaner list. A clearer send." }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><GoogleAdSense /></head>
      <body>
        {children}
      </body>
    </html>
  );
}
