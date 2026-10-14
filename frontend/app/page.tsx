import Link from "next/link";
import styles from "./landing.module.css";

const journey = [
  { number: "01", title: "Provider intake", detail: "Signed forms, invoices and clinical evidence" },
  { number: "02", title: "Explainable review", detail: "Policy version, rule findings and decisions" },
  { number: "03", title: "Settlement trace", detail: "Approved amount through reconciliation" },
];

export default function Home() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="Claimwise Health home">
          <span className={styles.mark}>C</span>
          <span className={styles.wordmark}>claimwise<span>.</span><small>HEALTH CLAIMS</small></span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#workspaces">Workspaces</a>
          <Link className={styles.navCta} href="/providers">Open workspace <span>→</span></Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> HEALTH CLAIMS, CONNECTED</p>
          <h1>Every claim.<br /><em>One clear path.</em></h1>
          <p className={styles.lede}>Bring providers and health insurers onto one transparent journey—from signed claim forms to explainable decisions and settlement.</p>
          <div className={styles.actions}>
            <Link className={styles.primaryCta} href="/providers">Explore provider workspace <span>→</span></Link>
            <a className={styles.textCta} href="#how-it-works">See how it works <span>↓</span></a>
          </div>
          <div className={styles.trustLine}>
            <span>01 <b>Provider intake</b></span><i />
            <span>02 <b>Rule-based review</b></span><i />
            <span>03 <b>Settlement trace</b></span>
          </div>
        </div>

        <div className={styles.journeyCard} aria-label="A connected health claim journey">
          <div className={styles.cardTop}><span>THE CLAIM JOURNEY</span><span className={styles.live}><i /> CONNECTED WORKFLOW</span></div>
          {journey.map((step, index) => (
            <div className={styles.journeyItem} key={step.number}>
              <span className={styles.stepNo}>{step.number}</span>
              <span className={styles.stepText}><b>{step.title}</b><small>{step.detail}</small></span>
              <span className={index < 2 ? styles.stepCheck : styles.stepArrow}>{index < 2 ? "✓" : "↗"}</span>
              {index < 2 && <span className={styles.connector} />}
            </div>
          ))}
          <div className={styles.participants}><span>Health facility</span><span>TPA & insurer</span><span>Finance</span></div>
        </div>
        <div className={styles.heroGlow} />
      </section>

      <section className={styles.workflow} id="how-it-works">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>BUILT FOR ACCOUNTABILITY</p>
          <h2>From first eligibility check<br />to final reconciliation.</h2>
          <p>Every decision stays connected to the policy, evidence and service date that shaped it.</p>
        </div>
        <div className={styles.workspaceCards} id="workspaces">
          <article><span>01 / PROVIDER</span><h3>Submit with confidence</h3><p>Upload signed claim forms, confirm extracted details, and track requests from the insurer review team.</p><Link href="/providers">Open provider workspace <span>→</span></Link></article>
          <article><span>02 / REVIEW</span><h3>See why a claim passes</h3><p>Reviewers assess evidence against versioned rules, request corrections and record clear outcomes.</p><Link href="/providers/reviewer">Preview review workspace <span>→</span></Link></article>
          <article><span>03 / TRACEABILITY</span><h3>Keep every step visible</h3><p>Claim versions, policy references, documents and decisions stay together in one claim history.</p><a href="#how-it-works">Explore the claim journey <span>→</span></a></article>
        </div>
      </section>

      <footer className={styles.footer}><span>CLAIMWISE HEALTH</span><span>Health claims, connected.</span></footer>
    </main>
  );
}
