import Link from "next/link";
import { case001, kes } from "@/lib/demo-data";

export function Dashboard() {
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">REFERENCE CASE <span className="eyebrow-dot">·</span> HEALTH CLAIMS</div>
          <h1>Good morning</h1>
          <p className="page-subtitle">A clear view of claim review, coverage rules and provider settlement.</p>
        </div>
        <Link className="button button-primary" href="/claims/new"><span>＋</span> Start a claim</Link>
      </div>

      <div className="notice-banner">
        <span className="notice-icon">i</span>
        <div><strong>Sample workspace</strong><span>Every figure below comes from synthetic Reference Case 001. Live APIs, sign-in and file upload are not connected.</span></div>
        <span className="notice-tag">SYNTHETIC</span>
      </div>

      <section className="metric-grid" aria-label="Reference case figures">
        <Metric label="Billed amount" value={kes(case001.billed)} meta="Reference Case 001" icon="▤" color="blue" />
        <Metric label="Eligible amount" value={kes(case001.eligible)} meta="After KES 6,400 corrections" icon="✓" color="green" />
        <Metric label="Insurer share" value={kes(case001.insurerShare)} meta="Fixture calculation only" icon="↗" color="violet" />
        <Metric label="Expected variance" value={kes(case001.variance)} meta="Exact simulated match" icon="＝" color="amber" />
      </section>

      <div className="content-grid dashboard-main-grid">
        <section className="panel claim-panel">
          <div className="panel-header">
            <div><p className="panel-kicker">REFERENCE WORKFLOW</p><h2>Claim overview</h2></div>
            <Link className="text-link" href="/claims/reference-case-001">View case <span>↗</span></Link>
          </div>
          <div className="claim-summary">
            <div className="claim-symbol">RC</div>
            <div className="claim-primary"><strong>Reference Case 001</strong><span>{case001.member} · {case001.policy}</span></div>
            <span className="status-pill status-reference"><i /> Reference fixture</span>
          </div>
          <div className="summary-details">
            <Detail label="Provider" value={case001.provider} />
            <Detail label="Insurer" value={case001.insurer} />
            <Detail label="TPA" value={case001.tpa} />
            <Detail label="Service date" value={case001.serviceDate} />
          </div>
          <div className="amount-strip">
            <div><span>Claim billed</span><strong>{kes(case001.billed)}</strong></div>
            <span className="amount-arrow">→</span>
            <div><span>Eligible</span><strong>{kes(case001.eligible)}</strong></div>
            <span className="amount-arrow">→</span>
            <div><span>Insurer share</span><strong>{kes(case001.insurerShare)}</strong></div>
          </div>
          <div className="panel-footer"><span>6 bill lines</span><span className="footer-dot" /><span>5 adjusted lines</span><span className="footer-dot" /><span>All totals from fixture</span></div>
        </section>

        <section className="panel rules-panel">
          <div className="panel-header">
            <div><p className="panel-kicker">ASSESSMENT BASIS</p><h2>Why was it adjusted?</h2></div>
            <Link className="small-icon-link" href="/rules" aria-label="View policy and rules">↗</Link>
          </div>
          <div className="finding-list">
            <Finding title="Tariff differences" lines="L01 · L02 · L03" amount={kes(3800)} color="blue" />
            <Finding title="Authorization ceiling" lines="L03 · MRI scan" amount={kes(3000)} color="violet" />
            <Finding title="Duplicate CBC" lines="L05 · duplicate line" amount={kes(1800)} color="amber" />
            <Finding title="Excluded fee" lines="L06 · admin fee" amount={kes(800)} color="rose" />
          </div>
          <div className="inline-callout"><span>ⓘ</span><p>Exact rule version IDs and source clauses were not included in the reference fixture.</p></div>
        </section>
      </div>

      <div className="content-grid lower-grid">
        <section className="panel timeline-panel">
          <div className="panel-header"><div><p className="panel-kicker">CASE JOURNEY</p><h2>From service to settlement</h2></div><span className="muted-label">FIXTURE DATES</span></div>
          <div className="journey-track">
            {case001.timeline.map((event, index) => <div className="journey-step" key={event.title}>
              <span className={`journey-node ${index === case001.timeline.length - 1 ? "node-last" : ""}`}>{index + 1}</span>
              <div><small>{event.date}</small><strong>{event.title}</strong><span>{event.detail}</span></div>
            </div>)}
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-header"><div><p className="panel-kicker">QUICK ACCESS</p><h2>Health records</h2></div></div>
          <QuickLink href="/policies" label="Policy & benefit" detail={case001.policy} icon="▧" />
          <QuickLink href="/providers" label="Provider agreement" detail={case001.contract} icon="⌂" />
          <QuickLink href="/authorizations" label="Preauthorization" detail={case001.authorization} icon="◉" />
          <QuickLink href="/audit" label="Case timeline" detail="Reference events" icon="◷" />
        </section>
      </div>
    </>
  );
}

function Metric({ label, value, meta, icon, color }: { label: string; value: string; meta: string; icon: string; color: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}>{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-meta">{meta}</span></article>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>; }
function Finding({ title, lines, amount, color }: { title: string; lines: string; amount: string; color: string }) {
  return <div className="finding-row"><span className={`finding-mark ${color}`}><i /></span><div className="finding-copy"><strong>{title}</strong><span>{lines}</span></div><strong className="finding-amount">{amount}</strong></div>;
}
function QuickLink({ href, label, detail, icon }: { href: string; label: string; detail: string; icon: string }) {
  return <Link className="quick-link" href={href}><span className="quick-icon">{icon}</span><span className="quick-copy"><strong>{label}</strong><small>{detail}</small></span><span className="quick-arrow">↗</span></Link>;
}
