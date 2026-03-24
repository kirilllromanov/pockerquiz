import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="heroCard">
        <p className="eyebrow">Mobile Quiz Table</p>
        <h1>Closer Wins</h1>
        <p className="lead">
          A host runs the round. Players enter one numeric answer, then decide
          whether to continue or fold after the question and each hint. The
          closest surviving answer takes the whole pot.
        </p>
        <div className="heroActions">
          <Link className="primaryButton" href="/host">
            Open host console
          </Link>
          <Link className="secondaryButton" href="/play">
            Open player screen
          </Link>
        </div>
      </section>

      <section className="featureGrid">
        <article className="featureCard">
          <p className="eyebrow">Flow</p>
          <h2>Round flow</h2>
          <p>
            Question, numeric answers, continue-or-fold choice, hint one, choice,
            hint two, choice, then the correct answer and winner reveal.
          </p>
        </article>
        <article className="featureCard">
          <p className="eyebrow">Host</p>
          <h2>Host controls</h2>
          <p>
            Add questions, attach images for each stage, reveal hints, move to the
            next round, and monitor every player score in one place.
          </p>
        </article>
        <article className="featureCard">
          <p className="eyebrow">Players</p>
          <h2>Player focus</h2>
          <p>
            One clean mobile-first card with the current prompt, answer field,
            continue or fold action, and the final round result.
          </p>
        </article>
      </section>
    </main>
  );
}
