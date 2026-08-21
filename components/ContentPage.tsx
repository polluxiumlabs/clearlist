import type { ReactNode } from "react";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

type Props = {
  kicker: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export default function ContentPage({ kicker, title, intro, children }: Props) {
  return (
    <main className="content-site">
      <SiteHeader />
      <header className="content-hero">
        <span className="section-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      <article className="article-shell">{children}</article>
      <SiteFooter />
    </main>
  );
}
