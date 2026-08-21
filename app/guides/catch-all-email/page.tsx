import type { Metadata } from "next";
import ContentPage from "../../../components/ContentPage";

export const metadata: Metadata = { title: "Catch-All Email Domains Explained — Clearlist", description: "Learn why catch-all domains accept unknown recipients, why verification becomes uncertain, and how to handle the result.", alternates: { canonical: "/guides/catch-all-email" } };

export default function CatchAllGuide() {
  return (
    <ContentPage kicker="Verification guide" title="Catch-all acceptance is not mailbox proof" intro="An accept-all domain can receive mail for any local part during the SMTP conversation, even when no matching person or inbox exists.">
      <section><h2>How catch-all detection works</h2><p>A verifier first identifies the domain’s mail server. It may then test a randomized address that is extremely unlikely to exist. If the server accepts both the real recipient and the random recipient, the domain behaves like a catch-all. The result describes the server policy, not the destination mailbox.</p></section>
      <section><h2>Why organizations use catch-all behavior</h2><p>Some organizations route mistyped addresses to a central inbox, preserve mail during staffing changes, or intentionally avoid revealing which users exist. Other providers accept recipients early and decide whether to deliver, quarantine, or bounce later. These systems reduce information available to outside verifiers.</p></section>
      <section><h2>Why the result is risky</h2><p>An accepted probe cannot distinguish a real employee mailbox from a nonexistent local part. Sending may still produce a delayed bounce, disappear into a sink, or reach an unintended shared inbox. Catch-all addresses should not be treated with the same confidence as a recipient-specific acceptance.</p></section>
      <section><h2>How to decide whether to send</h2><ul><li>Prefer addresses supplied directly by the recipient or published by the organization.</li><li>Confirm the person and company relationship through a reliable current source.</li><li>Check the organization’s known email pattern without inventing personal data.</li><li>Start with a small segment and monitor delayed bounces and replies.</li><li>Exclude guessed addresses when relevance or identity is uncertain.</li></ul></section>
      <section><h2>When unknown is the correct answer</h2><p>Some providers block the randomized test, rate-limit the connection, or return temporary responses. In those cases, catch-all status itself is unknown. Reporting uncertainty is more useful than forcing the address into valid or invalid.</p></section>
    </ContentPage>
  );
}
