import type { Metadata } from "next";
import ContentPage from "../../../components/ContentPage";

export const metadata: Metadata = { title: "Role-Based Email Addresses — Clearlist", description: "Understand shared inboxes such as info@, sales@, support@, and when they create outreach risk.", alternates: { canonical: "/guides/role-based-email" } };

export default function RoleAddressGuide() {
  return (
    <ContentPage kicker="List-quality guide" title="A working shared inbox can still be a poor target" intro="Role-based addresses are organized around a function, not one identified person. That changes relevance, consent, and complaint risk.">
      <section><h2>Common role addresses</h2><p>Examples include info@, hello@, sales@, support@, billing@, careers@, privacy@, abuse@, and webmaster@. Many are active and important. The risk comes from using them outside their intended purpose.</p></section>
      <section><h2>Why verifiers mark them risky</h2><p>Several employees may read a shared inbox, ownership can change without notice, and the address may feed a ticketing system. A cold promotion sent to a privacy or support address can create complaints even though the mailbox is technically deliverable.</p></section>
      <section><h2>When a role address is appropriate</h2><p>Use it when the message directly matches the published function: a customer request to support, an invoice question to billing, a job application to careers, or a privacy request to privacy. The organization has indicated the intended purpose, and your message follows it.</p></section>
      <section><h2>When to avoid it</h2><p>Avoid adding generic company addresses to bulk sales sequences simply because a named contact is unavailable. Do not send marketing to abuse, security, privacy, legal, unsubscribe, or postmaster addresses. Those inboxes exist for operational and compliance work.</p></section>
      <section><h2>A practical review rule</h2><ol><li>Identify the function implied by the local part.</li><li>Compare that function with the actual purpose of your message.</li><li>Use the address only when the match would be obvious to a neutral recipient.</li><li>Send individually when context is important.</li><li>Honor any request to stop across the relevant organization and campaign.</li></ol></section>
    </ContentPage>
  );
}
