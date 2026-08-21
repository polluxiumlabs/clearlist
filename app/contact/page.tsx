import type { Metadata } from "next";
import ContentPage from "../../components/ContentPage";
import ContactForm from "./ContactForm";

export const metadata: Metadata = { title: "Contact Clearlist Support", description: "Contact Clearlist for product support, privacy questions, feedback, or data requests through our secure support form.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return (
    <ContentPage kicker="Contact" title="Questions, support, or privacy requests" intro="Send a clear request through the secure form. Your message goes to our private Firestore database and is never added to an email-verification list.">
      <section className="contact-card">
        <h2>Contact Clearlist</h2>
        <p>For an optional stored CSV, use the “Delete stored copy” control in the workspace first. Include only the upload reference—not the contact list itself—if you still need help.</p>
        {contactEmail && <p>Prefer email? Write to <a className="contact-link" href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>}
        <ContactForm />
      </section>
    </ContentPage>
  );
}
