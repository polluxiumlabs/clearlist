import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = { title: "Terms of Use — Clearlist", description: "Rules and limitations for using the Clearlist email verification service.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <ContentPage kicker="Legal" title="Terms of use" intro="By using Clearlist, you agree to use the service lawfully, responsibly, and with realistic expectations. Last updated August 21, 2026.">
      <section><h2>Permitted use</h2><p>You may use Clearlist to assess contact data that you are authorized to process. You are responsible for the source of the data, the legal basis for processing, campaign compliance, consent where required, unsubscribe handling, and the messages you send.</p></section>
      <section><h2>Prohibited use</h2><ul><li>Do not upload stolen, purchased, unlawfully scraped, or sensitive personal data.</li><li>Do not use the service to facilitate spam, harassment, fraud, impersonation, phishing, or evasion of provider limits.</li><li>Do not attempt to disrupt, reverse engineer, overload, or bypass controls on the service or receiving mail systems.</li><li>Do not describe a Clearlist result as proof of identity, consent, inbox placement, or future deliverability.</li></ul></section>
      <section><h2>Result limitations</h2><p>Verification results are time-sensitive technical signals. Providers may block checks, return temporary responses, accept all recipients, or change behavior. A valid result is not a delivery guarantee. An unknown result is not confirmation that a mailbox exists.</p></section>
      <section><h2>Availability</h2><p>The service is provided on an as-available basis and may be limited, changed, suspended, or discontinued. Rate limits and batch limits may be applied to protect infrastructure and mail providers.</p></section>
      <section><h2>Disclaimer and liability</h2><p>To the extent permitted by law, Clearlist is provided without warranties of accuracy, availability, merchantability, fitness for a particular purpose, or non-infringement. The publisher is not liable for campaign performance, blocked mail, lost data, indirect damages, or decisions made solely from a verification result.</p></section>
      <section><h2>Changes</h2><p>These terms may be updated as the product, providers, or legal requirements change. The revised date identifies the version that applies to new use.</p></section>
    </ContentPage>
  );
}
