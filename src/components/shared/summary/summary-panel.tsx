import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./summary-panel.module.css";

export type SummaryCard = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  sourceIds?: string[];
};
export type SummaryPanelProps = {
  title: string;
  description: string;
  cards: SummaryCard[];
  emptyMessage: string;
  nextSteps: string;
  links?: { href: string; label: string }[];
  onEvidence?: (ids: string[], title: string) => void;
};

export default function SummaryPanel({ title, description, cards, emptyMessage, nextSteps, links, onEvidence }: SummaryPanelProps) {
  return <section className={`workspace-content ${styles.summary}`} aria-label={title}>
    <div><h2>{title}</h2><p className={styles.description}>{description}</p></div>
    {cards.length ? <div className="metric-grid">{cards.map((card) => <article className={`metric-card ${styles.card}`} key={card.id}>
      <h3>{card.label}</h3><strong>{card.value}</strong>{card.detail ? <p>{card.detail}</p> : null}
      {onEvidence && card.sourceIds?.length ? <button className={`text-button ${styles.evidence}`} onClick={() => onEvidence(card.sourceIds!, card.label)}>View evidence<ArrowRight size={14} /></button> : null}
    </article>)}</div> : <p className={`panel ${styles.empty}`} role="status">{emptyMessage}</p>}
    <div className={`panel ${styles.nextSteps}`}><span className="eyebrow">FOUNDATION PREVIEW</span><h3>Feature work still to come</h3><p>{nextSteps}</p></div>
    {links?.length ? <nav aria-label="Related work" className={styles.links}>{links.map((link) => <Link className="button button-outline" href={link.href} prefetch={false} key={link.href}>{link.label}<ArrowRight size={14} /></Link>)}</nav> : null}
  </section>;
}
