import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleHelp, Store, Users } from "lucide-react";

type PageContent = { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string }> };
type RelatedLink = { label: string; href: string };

export default function MarketplaceInfoContent({ content, relatedTitle, relatedLinks, supportEmail }: { content: PageContent; relatedTitle: string; relatedLinks: RelatedLink[]; supportEmail?: string }) {
  return <article className="marketInfoContent infoGuide">
    <header className="infoGuideHeader"><span><CircleHelp size={17} aria-hidden="true"/>{content.eyebrow}</span><h1>{content.title}</h1><p>{content.intro}</p></header>
    <div className="infoGuideGrid">{content.sections.map((section, index) => <section key={section.title}>
      <div className="infoGuideSectionIcon" aria-hidden="true">{index === 0 ? <Users size={21}/> : index === 1 ? <Store size={21}/> : <CheckCircle2 size={21}/>}</div>
      <div><h2>{section.title}</h2><p>{section.body}</p></div>
    </section>)}</div>
    {supportEmail && <a className="infoGuideEmail" href={`mailto:${supportEmail}`}>{supportEmail}</a>}
    <nav className="infoGuideRelated" aria-label={relatedTitle}><h2>{relatedTitle}</h2><div>{relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}<ArrowRight size={17} aria-hidden="true"/></Link>)}</div></nav>
  </article>;
}
