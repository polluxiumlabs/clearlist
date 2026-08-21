import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = {
  title: "Email Verification Guide — Clearlist",
  description: "A practical guide to syntax, domain, MX, SMTP, catch-all, role-based, disposable, and unknown email verification results.",
  alternates: { canonical: "/email-verification-guide" },
};

export default function EmailVerificationGuide() {
  return (
    <ContentPage kicker="Field guide" title="How email verification actually works" intro="Email verification is a layered risk assessment, not a promise that every accepted address will receive, open, or engage with your message.">
      <section>
        <h2>Start with the right expectation</h2>
        <p>An email verifier can identify malformed addresses, domains that do not exist, domains without mail routing, and some mailboxes that explicitly accept or reject a delivery probe. It cannot guarantee inbox placement. Providers deliberately limit mailbox discovery, temporary server failures happen, and a valid mailbox can still block an unwanted campaign.</p>
        <p>Use verification to reduce obvious list problems before a campaign. Then protect your sender reputation with permission, relevant targeting, conservative volume, authentication, and an easy way to unsubscribe.</p>
      </section>
      <section>
        <h2>The verification layers</h2>
        <div className="article-cards">
          <article><span>01</span><h3>Syntax</h3><p>The address must have a valid local part, an @ sign, and a usable domain format. Syntax can reject an address decisively, but passing syntax proves only that the text is well formed.</p></article>
          <article><span>02</span><h3>Domain and DNS</h3><p>The domain must exist and answer DNS queries. A timeout is different from a missing domain, so a responsible verifier reports temporary lookup failures as unknown.</p></article>
          <article><span>03</span><h3>MX records</h3><p>Mail exchanger records show where a domain receives email. Missing mail routing is a strong invalid signal. Present MX records still do not prove that one specific mailbox exists.</p></article>
          <article><span>04</span><h3>Mailbox response</h3><p>An SMTP conversation may reveal whether the receiving server accepts or rejects the recipient. Many large providers hide this signal, rate-limit probes, or accept every recipient before filtering later.</p></article>
        </div>
      </section>
      <section>
        <h2>What each Clearlist status means</h2>
        <h3>Valid</h3>
        <p>The mailbox server accepted the verification request. This is the strongest result available to the tool, but it is not a guarantee of delivery or inbox placement. The mailbox may later become unavailable, apply policy filtering, or route the campaign to spam.</p>
        <h3>Invalid</h3>
        <p>A decisive check failed: the syntax is malformed, the domain does not exist, the domain has no mail routing, or the mailbox explicitly rejected the recipient. Exclude these addresses unless you can correct them from a trusted source.</p>
        <h3>Risky</h3>
        <p>The address may receive mail, but its pattern can increase campaign risk. Examples include disposable services, catch-all domains, and role addresses such as sales@ or support@. Review the source and relevance before including it.</p>
        <h3>Unknown</h3>
        <p>The system could not obtain a decisive mailbox answer. This often happens because the provider blocked verification, the lookup timed out, or SMTP probing was unavailable. Unknown does not mean valid and does not mean invalid. Send only when you have another trustworthy reason to believe the address belongs in your audience.</p>
      </section>
      <section>
        <h2>Manual checks that do not create false confidence</h2>
        <ul>
          <li>Confirm the address came from the person, their company, or another reliable first-party source.</li>
          <li>Visit the organization’s official domain and confirm that it is active and relevant.</li>
          <li>Check whether the company uses the same email pattern for publicly listed staff.</li>
          <li>Send a small, relevant, non-deceptive message and monitor the actual bounce response.</li>
          <li>Suppress hard bounces immediately and avoid repeatedly testing rejected recipients.</li>
        </ul>
        <p>Do not send a blank “test” message, impersonate a conversation, or use open tracking as proof of identity. Those tactics can damage trust and do not establish permission.</p>
      </section>
      <section>
        <h2>Verification and privacy</h2>
        <p>A contact list can contain personal data. Process only the fields needed for the task, keep storage private, use short retention, avoid personal information in filenames, and give users a direct deletion option. Clearlist parses and deduplicates CSV data in the browser. Cloud storage is optional and requires a separate consent choice.</p>
      </section>
    </ContentPage>
  );
}
