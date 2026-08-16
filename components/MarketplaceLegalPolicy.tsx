import { AlertTriangle, FileText, MessageCircle } from "lucide-react";

type LegalSection = { title: string; body: string };

export default function MarketplaceLegalPolicy({ title, intro, statusNote, traderNote, sections, contactHref, contactLabel, relatedLinks=[] }: { title: string; intro: string; statusNote: string; traderNote?: string; sections: LegalSection[]; contactHref: string; contactLabel: string; relatedLinks?:Array<{label:string;href:string}> }) {
  return <article className="marketInfoContent legalPolicy">
    <header className="legalPolicyHeader"><FileText size={30} aria-hidden="true"/><h1>{title}</h1><p>{intro}</p></header>
    <div className="legalPolicyNotice"><strong>Todijo</strong><p>{statusNote}</p></div>
    {traderNote && <div className="legalPolicyNotice legalPolicyWarning"><AlertTriangle size={20} aria-hidden="true"/><p>{traderNote}</p></div>}
    <nav className="legalPolicyToc" aria-label={title}>{sections.map((section, index) => <a href={`#legal-section-${index + 1}`} key={section.title}>{index + 1}. {section.title}</a>)}</nav>
    <div className="legalPolicySections">{sections.map((section, index) => <section id={`legal-section-${index + 1}`} key={section.title}><h2>{section.title}</h2><p>{/support@todijo\.com/i.test(section.body) ? contactLabel : section.body}</p></section>)}</div>
    {relatedLinks.length>0&&<nav className="legalPolicyRelated" aria-label={title}>{relatedLinks.map((link)=><a href={link.href} key={link.href}>{link.label}</a>)}</nav>}
    <a className="legalPolicyContact" href={contactHref}><MessageCircle size={18} aria-hidden="true"/>{contactLabel}</a>
  </article>;
}
