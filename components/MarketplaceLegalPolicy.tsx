import { AlertTriangle, FileText, Mail } from "lucide-react";

type LegalSection = { title: string; body: string };

export default function MarketplaceLegalPolicy({ title, intro, statusNote, traderNote, sections, supportEmail }: { title: string; intro: string; statusNote: string; traderNote?: string; sections: LegalSection[]; supportEmail: string }) {
  return <article className="marketInfoContent legalPolicy">
    <header className="legalPolicyHeader"><FileText size={30} aria-hidden="true"/><h1>{title}</h1><p>{intro}</p></header>
    <div className="legalPolicyNotice"><strong>Todijo</strong><p>{statusNote}</p></div>
    {traderNote && <div className="legalPolicyNotice legalPolicyWarning"><AlertTriangle size={20} aria-hidden="true"/><p>{traderNote}</p></div>}
    <nav className="legalPolicyToc" aria-label={title}>{sections.map((section, index) => <a href={`#legal-section-${index + 1}`} key={section.title}>{index + 1}. {section.title}</a>)}</nav>
    <div className="legalPolicySections">{sections.map((section, index) => <section id={`legal-section-${index + 1}`} key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}</div>
    <a className="legalPolicyContact" href={`mailto:${supportEmail}`}><Mail size={18} aria-hidden="true"/>{supportEmail}</a>
  </article>;
}
