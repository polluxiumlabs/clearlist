import type { Metadata } from "next";
import Link from "next/link";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = { title: "Email Quality Guides — Clearlist", description: "Original, practical guides to email verification, authentication, bounces, catch-all domains, role addresses, and deliverability.", alternates: { canonical: "/guides" } };

const guides = [
  ["Email verification", "Understand syntax, domains, MX, SMTP, and the limits of every result.", "/email-verification-guide"],
  ["Deliverability", "Connect list quality with authentication, targeting, volume, and complaints.", "/deliverability-guide"],
  ["Email bounces", "Learn the difference between hard bounces, soft bounces, blocks, and deferrals.", "/guides/email-bounces"],
  ["SPF, DKIM, and DMARC", "Build a trustworthy domain-authentication foundation without guessing.", "/guides/spf-dkim-dmarc"],
  ["Catch-all domains", "Decide when an accept-all result is useful, risky, or simply unknown.", "/guides/catch-all-email"],
  ["Role-based addresses", "Handle sales@, info@, support@, and other shared inboxes responsibly.", "/guides/role-based-email"],
];

export default function GuidesPage() {
  return (
    <ContentPage kicker="Learning center" title="Practical email-quality guides" intro="Use these guides to interpret verification results, reduce preventable bounces, and make better sending decisions without false certainty.">
      <section className="guide-directory">
        {guides.map(([title, description, href]) => <Link href={href} key={href}><span>Guide</span><h2>{title}</h2><p>{description}</p><b>Read guide →</b></Link>)}
      </section>
    </ContentPage>
  );
}
