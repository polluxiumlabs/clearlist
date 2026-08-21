import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand" href="/" aria-label="Clearlist home"><span className="brand-mark"><span /></span><span>clearlist</span></Link>
      <div className="footer-links">
        <Link href="/guides">Guides</Link>
        <Link href="/email-verification-guide">Verification</Link>
        <Link href="/deliverability-guide">Deliverability</Link>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
      <p>Practical email-list quality signals.</p>
    </footer>
  );
}
