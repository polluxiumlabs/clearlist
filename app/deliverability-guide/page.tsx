import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = {
  title: "Cold Email Deliverability Guide — Clearlist",
  description: "Improve email deliverability with list quality, domain authentication, responsible sending, bounce handling, and useful content.",
  alternates: { canonical: "/deliverability-guide" },
};

export default function DeliverabilityGuide() {
  return (
    <ContentPage kicker="Sender guide" title="A valid address is only the beginning" intro="Inbox placement depends on who you contact, what you send, and how consistently your domain behaves—not just whether a mailbox exists.">
      <section>
        <h2>List quality and sender quality are different</h2>
        <p>Verification reduces preventable bounces. It does not repair a poor offer, missing permission, aggressive volume, misleading copy, or weak domain reputation. Mail providers combine many signals: authentication, complaints, engagement, bounce history, sending consistency, content, links, and recipient behavior.</p>
      </section>
      <section>
        <h2>Build the technical foundation</h2>
        <h3>Authenticate the sending domain</h3>
        <p>Publish SPF so receiving systems can identify authorized senders. Enable DKIM so messages carry a verifiable signature. Add DMARC with reporting, begin with a monitoring policy, and tighten enforcement only after every legitimate sender is aligned.</p>
        <h3>Separate outreach from critical mail</h3>
        <p>Do not experiment with cold outreach on the same identity used for password resets, invoices, or customer support. A dedicated, clearly branded sending subdomain can limit operational risk, but it does not excuse poor practices.</p>
        <h3>Use consistent identity</h3>
        <p>Your From name, address, domain, reply-to address, signature, and linked website should agree. Avoid link shorteners and unrelated tracking domains that make the message harder to trust.</p>
      </section>
      <section>
        <h2>Prepare the audience</h2>
        <div className="article-cards">
          <article><span>01</span><h3>Verify before sending</h3><p>Remove malformed, nonexistent, and rejected recipients. Review risky and unknown results rather than automatically including them.</p></article>
          <article><span>02</span><h3>Segment by relevance</h3><p>A smaller list with a clear reason to care is safer than a broad scrape. Personalization should be accurate and useful, not decorative.</p></article>
          <article><span>03</span><h3>Control volume</h3><p>Increase volume gradually, keep daily patterns stable, and avoid sudden bursts. Monitor by sending domain and mailbox provider.</p></article>
          <article><span>04</span><h3>Maintain suppression</h3><p>Never resend to hard bounces or people who opted out. Apply suppression before every campaign, not after the messages leave.</p></article>
        </div>
      </section>
      <section>
        <h2>Write for the recipient</h2>
        <p>Use a truthful subject line, identify yourself, explain the relevant reason for contact, and make the next step easy to understand. Keep the first message concise. Avoid fake reply prefixes, false urgency, invisible text, excessive punctuation, attachment-heavy introductions, and claims that cannot be supported.</p>
        <p>Provide a clear opt-out and honor it promptly. In addition to improving trust, this helps prevent complaints—the strongest negative signal a recipient can send.</p>
      </section>
      <section>
        <h2>Monitor the signals that matter</h2>
        <ul>
          <li><strong>Hard bounce rate:</strong> a direct measure of bad or unavailable destinations.</li>
          <li><strong>Complaint rate:</strong> a strong sign that targeting, permission, or message expectations are wrong.</li>
          <li><strong>Provider-specific deferrals:</strong> repeated temporary blocks may indicate volume or reputation pressure.</li>
          <li><strong>Reply quality:</strong> relevant replies are more useful than open rates, which can be distorted by privacy features.</li>
          <li><strong>Unsubscribe rate:</strong> a practical signal that the audience or frequency needs adjustment.</li>
        </ul>
      </section>
      <section>
        <h2>A conservative sending workflow</h2>
        <ol>
          <li>Collect addresses from a lawful, relevant source and record why each segment should be contacted.</li>
          <li>Verify the list, exclude invalid entries, and manually review risky and unknown addresses.</li>
          <li>Apply your suppression list and remove anyone who previously opted out or complained.</li>
          <li>Send a small first batch, monitor bounces and complaints, and pause when quality worsens.</li>
          <li>Use the results to improve targeting. Do not simply increase volume because a batch technically sent.</li>
        </ol>
      </section>
    </ContentPage>
  );
}
