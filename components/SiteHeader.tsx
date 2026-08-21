import Link from "next/link";

export default function SiteHeader() {
  return (
    <nav className="nav-shell" aria-label="Primary navigation">
      <Link className="brand" href="/" aria-label="Clearlist home">
        <span className="brand-mark"><span /></span><span>clearlist</span>
      </Link>
      <div className="nav-actions">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/guides">Guides</Link>
        <Link href="/deliverability-guide">Deliverability</Link>
        <Link href="/about">About</Link>
        <span className="privacy-pill"><span className="shield-mark" aria-hidden="true">✓</span> Privacy controls</span>
      </div>
    </nav>
  );
}
