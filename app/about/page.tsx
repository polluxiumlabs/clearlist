import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = { title: "About Clearlist", description: "Why Clearlist reports practical email quality signals without promising impossible certainty.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <ContentPage kicker="About Clearlist" title="Useful signals, explained honestly" intro="Clearlist is a focused email-list quality tool for people who want fewer obvious bounces and clearer decisions before they send.">
      <section><h2>Why this tool exists</h2><p>Email verification products often turn a complex, changing network response into an absolute promise. Clearlist takes a more careful approach. It separates decisive failures from risk indicators and reports provider blocks or timeouts as unknown instead of pretending the mailbox is valid.</p></section>
      <section><h2>What Clearlist checks</h2><p>The verifier examines address syntax, domain availability, MX records, disposable providers, role-address patterns, optional SMTP responses, and catch-all behavior when the infrastructure permits those checks. Every row includes a reason so you can understand the classification.</p></section>
      <section><h2>What Clearlist cannot promise</h2><p>No verifier can guarantee inbox placement, future mailbox availability, engagement, consent, or campaign performance. Verification is one part of responsible list preparation. Sender authentication, relevance, volume, complaints, and bounce handling still determine whether a campaign is trusted.</p></section>
      <section><h2>Data choices</h2><p>CSV parsing and deduplication happen in the browser. Users may optionally send a private copy to encrypted object storage for short-term processing continuity. That option is separate, clearly labeled, and can be deleted with the control shown in the workspace.</p></section>
      <section><h2>How the guides are maintained</h2><p>Clearlist’s guides are written for this site and reviewed against primary documentation from mailbox providers, standards organizations, and platform policy sources. Material corrections are applied when behavior or guidance changes. Product pages separate observed verification signals from conclusions that the technology cannot support.</p></section>
    </ContentPage>
  );
}
