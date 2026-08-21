import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";

export const metadata: Metadata = { title: "Contact Clearlist", description: "Contact Clearlist about support, privacy, or data deletion.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return (
    <ContentPage kicker="Contact" title="Questions, support, or privacy requests" intro="Use the public support address below for product questions, data requests, and corrections.">
      <section className="contact-card">
        <h2>Contact the publisher</h2>
        {contactEmail ? <p><a className="contact-link" href={`mailto:${contactEmail}`}>{contactEmail}</a></p> : <p>The public support email has not been configured yet. The site owner must set <code>NEXT_PUBLIC_CONTACT_EMAIL</code> before submitting this site to AdSense.</p>}
        <p>For an optional stored CSV, use the “Delete stored copy” control in the workspace first. Include only the upload reference—not the contact list itself—if you still need help.</p>
      </section>
    </ContentPage>
  );
}
