import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("publishes substantial content and trust pages", async () => {
  const required = [
    "app/email-verification-guide/page.tsx",
    "app/deliverability-guide/page.tsx",
    "app/about/page.tsx",
    "app/contact/page.tsx",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/robots.ts",
    "app/sitemap.ts",
  ];
  await Promise.all(required.map((path) => access(new URL(path, root))));

  const [verificationGuide, deliverabilityGuide, privacy] = await Promise.all([
    readFile(new URL("app/email-verification-guide/page.tsx", root), "utf8"),
    readFile(new URL("app/deliverability-guide/page.tsx", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
  ]);
  assert.ok(verificationGuide.length > 5000);
  assert.ok(deliverabilityGuide.length > 4000);
  assert.match(privacy, /Backblaze B2/);
  assert.match(privacy, /Google AdSense/);
});

test("does not make the removed marketing claim", async () => {
  const source = await readFile(new URL("app/CleanerApp.tsx", root), "utf8");
  assert.doesNotMatch(source, /No sign-up\. No storage\. No surprises\./);
  assert.match(source, /Unknown never means automatically valid/i);
});

test("keeps Google services and contact identity configuration explicit", async () => {
  const [adsense, analytics, contact, contactForm, privacy, env] = await Promise.all([
    readFile(new URL("components/GoogleAdSense.tsx", root), "utf8"),
    readFile(new URL("components/GoogleAnalytics.tsx", root), "utf8"),
    readFile(new URL("app/contact/page.tsx", root), "utf8"),
    readFile(new URL("app/contact/ContactForm.tsx", root), "utf8"),
    readFile(new URL("app/privacy/page.tsx", root), "utf8"),
    readFile(new URL(".env.example", root), "utf8"),
  ]);
  assert.match(adsense, /NEXT_PUBLIC_ADSENSE_CLIENT/);
  assert.match(analytics, /NEXT_PUBLIC_GA_MEASUREMENT_ID/);
  assert.match(contact, /NEXT_PUBLIC_CONTACT_EMAIL/);
  assert.match(contactForm, /\/api\/contact/);
  assert.match(contactForm, /privacy_accepted/);
  assert.match(privacy, /Firebase Firestore/);
  assert.doesNotMatch(env, /ca-pub-\d{6,}/);
  assert.doesNotMatch(env, /G-[A-Z0-9]{6,}/);
});

test("keeps the admin dashboard text-only", async () => {
  const admin = await readFile(new URL("app/admin/page.tsx", root), "utf8");
  assert.doesNotMatch(admin, /[🔄📁✉️📥✨🗑️✕]/u);
});

test("publishes consistent crawl and structured-data signals", async () => {
  const [layout, robots, sitemap] = await Promise.all([
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/robots.ts", root), "utf8"),
    readFile(new URL("app/sitemap.ts", root), "utf8"),
  ]);
  assert.match(layout, /application\/ld\+json/);
  assert.match(layout, /WebApplication/);
  assert.match(robots, /sitemap\.xml/);
  assert.doesNotMatch(robots, /clearlist\.example/);
  assert.doesNotMatch(sitemap, /clearlist\.example/);
});
