"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

type FormStatus = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [feedback, setFeedback] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    setFeedback("");

    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          topic: data.get("topic"),
          message: data.get("message"),
          company_website: data.get("company_website"),
          privacy_accepted: data.get("privacy_accepted") === "on",
        }),
      });
      const result = await response.json().catch(() => null) as { detail?: string } | null;
      if (!response.ok) throw new Error(result?.detail || "Your message could not be sent.");
      form.reset();
      setStatus("sent");
      setFeedback("Thanks—your message was received. We’ll review it as soon as possible.");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Your message could not be sent. Please try again.");
    }
  };

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-field-grid">
        <label>
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" minLength={2} maxLength={80} required />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
      </div>
      <label>
        <span>What can we help with?</span>
        <select name="topic" defaultValue="support" required>
          <option value="support">Product support</option>
          <option value="privacy">Privacy question</option>
          <option value="data-request">Data request or deletion</option>
          <option value="feedback">Product feedback</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>
        <span>Message</span>
        <textarea name="message" rows={7} minLength={20} maxLength={3000} placeholder="Please include enough detail for us to understand the request. Do not paste contact lists, passwords, or private keys." required />
        <small>20–3,000 characters. Never include passwords, secret keys, or CSV contact data.</small>
      </label>
      <label className="contact-honeypot" aria-hidden="true">
        <span>Company website</span>
        <input name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="contact-consent">
        <input name="privacy_accepted" type="checkbox" required />
        <span>I understand that Clearlist will store this message and my reply email in Firebase to respond to my request, as explained in the <Link href="/privacy">Privacy Policy</Link>.</span>
      </label>
      <button className="contact-submit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
      {feedback && <p className={`contact-feedback ${status}`} role={status === "error" ? "alert" : "status"}>{feedback}</p>}
    </form>
  );
}
