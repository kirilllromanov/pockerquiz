import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <section className="heroCard">
        <p className="eyebrow">Realtime Quiz Table</p>
        <h1>Poker Quiz</h1>
        <p className="lead">
          Один ведущий управляет вопросами, подсказками и ставками. Игроки отвечают
          числом, торгуются за банк и вскрываются только после правильного ответа.
        </p>
        <div className="heroActions">
          <Link className="primaryButton" href="/host">
            Открыть админку ведущего
          </Link>
          <Link className="secondaryButton" href="/play">
            Перейти в режим игрока
          </Link>
        </div>
      </section>

      <section className="featureGrid">
        <article className="featureCard">
          <p className="eyebrow">Flow</p>
          <h2>Как идёт раунд</h2>
          <p>
            Вопрос, ответы игроков, круг ставок, первая подсказка, ещё круг,
            вторая подсказка, последний круг, вскрытие и делёж банка.
          </p>
        </article>
        <article className="featureCard">
          <p className="eyebrow">Host</p>
          <h2>Что видит ведущий</h2>
          <p>
            Полный стол: банк вопросов, текущий раунд, ставки, балансы, ответы
            после вскрытия и кнопки перехода между этапами.
          </p>
        </article>
        <article className="featureCard">
          <p className="eyebrow">Players</p>
          <h2>Что видят игроки</h2>
          <p>
            Текущий вопрос, открытые подсказки, свой стек, действия ставок и общий
            баланс всех участников.
          </p>
        </article>
      </section>
    </main>
  );
}
