"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import { useGameState } from "@/components/use-game-state";

export function HostDashboard() {
  const { state, error, hostAction, isPending } = useGameState("host");
  const [questionForm, setQuestionForm] = useState({
    text: "",
    answer: "",
    hint1: "",
    hint2: "",
  });

  const question = state?.currentQuestionIndex !== undefined && state.currentQuestionIndex >= 0
    ? state.questions[state.currentQuestionIndex]
    : null;
  const hand = state?.currentHand ?? null;
  const answersCount = hand ? Object.keys(hand.submittedAnswers).length : 0;

  async function handleAddQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await hostAction("add-question", {
      text: questionForm.text,
      answer: Number(questionForm.answer),
      hint1: questionForm.hint1,
      hint2: questionForm.hint2,
    });
    setQuestionForm({
      text: "",
      answer: "",
      hint1: "",
      hint2: "",
    });
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Host Console</p>
          <h1>Ведущий</h1>
        </div>
        <Link className="ghostButton" href="/">
          На главную
        </Link>
      </div>

      <section className="grid twoColumns">
        <div className="panel">
          <p className="eyebrow">Управление игрой</p>
          <h2>Статус</h2>
          {state ? (
            <div className="stack">
              <p className="statusLine">
                Фаза: <strong>{renderPhase(state.phase, hand?.revealedHints ?? 0)}</strong>
              </p>
              <p className="statusLine">
                Игроков в игре: <strong>{state.players.filter((player) => !player.isEliminated).length}</strong>
              </p>
              <p className="statusLine">
                Ответов на текущий вопрос: <strong>{answersCount}</strong>
              </p>
              <p className="statusLine">
                Банк: <strong>{hand?.pot ?? 0}</strong>
              </p>
              <p className="statusMessage">{state.message}</p>
            </div>
          ) : (
            <p>Загружаю состояние стола...</p>
          )}

          <div className="buttonRow">
            <button className="primaryButton" disabled={!state || isPending} onClick={() => void hostAction("start-game")}>
              Запустить игру
            </button>
            <button className="secondaryButton" disabled={!hand || state?.phase === "betting"} onClick={() => void hostAction("start-betting")}>
              Запустить круг ставок
            </button>
            <button className="secondaryButton" disabled={!hand || hand.revealedHints >= 2 || state?.phase === "betting"} onClick={() => void hostAction("reveal-hint")}>
              Открыть подсказку
            </button>
            <button className="secondaryButton" disabled={!hand || state?.phase === "betting" || hand.result !== null} onClick={() => void hostAction("showdown")}>
              Вскрыть ответы
            </button>
            <button className="secondaryButton" disabled={!hand || hand.result === null} onClick={() => void hostAction("next-question")}>
              Следующий вопрос
            </button>
            <button className="dangerButton" onClick={() => void hostAction("reset-game")}>
              Сбросить всё
            </button>
          </div>

          {error ? <p className="errorText">{error}</p> : null}
        </div>

        <div className="panel">
          <p className="eyebrow">Редактор вопросов</p>
          <h2>Новый вопрос</h2>
          <form className="form" onSubmit={handleAddQuestion}>
            <label className="field">
              <span>Вопрос</span>
              <textarea
                value={questionForm.text}
                onChange={(event) => setQuestionForm((current) => ({ ...current, text: event.target.value }))}
                rows={4}
                placeholder="Сколько километров в марафоне?"
              />
            </label>
            <div className="grid compactGrid">
              <label className="field">
                <span>Правильный ответ</span>
                <input
                  type="number"
                  value={questionForm.answer}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, answer: event.target.value }))}
                  placeholder="42"
                />
              </label>
              <label className="field">
                <span>Подсказка 1</span>
                <input
                  value={questionForm.hint1}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, hint1: event.target.value }))}
                  placeholder="Чуть больше сорока"
                />
              </label>
              <label className="field">
                <span>Подсказка 2</span>
                <input
                  value={questionForm.hint2}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, hint2: event.target.value }))}
                  placeholder="Ответ с десятыми"
                />
              </label>
            </div>
            <button className="primaryButton" type="submit">
              Добавить вопрос
            </button>
          </form>
        </div>
      </section>

      <section className="grid twoColumns">
        <div className="panel">
          <p className="eyebrow">Текущий стол</p>
          <h2>Игроки и балансы</h2>
          <div className="tableList">
            {(state?.players ?? []).map((player) => {
              const submitted = hand?.submittedAnswers[player.id];
              const roundContribution = hand?.roundContributions[player.id] ?? 0;
              const totalContribution = hand?.totalContributions[player.id] ?? 0;
              const isFolded = hand?.foldedPlayerIds.includes(player.id);
              const resultAward = hand?.result?.awarded[player.id] ?? 0;
              return (
                <article className="tableRow" key={player.id}>
                  <div>
                    <strong>{player.name}</strong>
                    <p>
                      Баланс: {player.stack}
                      {player.isEliminated ? " • выбыл" : ""}
                    </p>
                  </div>
                  <div className="alignRight">
                    <p>Ответ: {submitted ?? "—"}</p>
                    <p>Раунд: {roundContribution} • Всего: {totalContribution}</p>
                    <p>{isFolded ? "Пас" : "В игре"}{resultAward > 0 ? ` • +${resultAward}` : ""}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Текущий вопрос</p>
          <h2>{question?.text ?? "Игра ещё не запущена"}</h2>
          {question && hand ? (
            <div className="stack">
              <p className="statusLine">
                Правильный ответ: <strong>{hand.result ? question.answer : "скрыт до вскрытия"}</strong>
              </p>
              <p className="statusLine">
                Подсказка 1: <strong>{hand.revealedHints >= 1 ? question.hints[0] : "ещё не открыта"}</strong>
              </p>
              <p className="statusLine">
                Подсказка 2: <strong>{hand.revealedHints >= 2 ? question.hints[1] : "ещё не открыта"}</strong>
              </p>
              <p className="statusLine">
                Текущая ставка: <strong>{hand.currentBet}</strong>
              </p>
              {hand.result ? (
                <div className="resultBox">
                  <p>
                    Вскрытие: {hand.result.reason === "closest-answer" ? "победил ближайший ответ" : "все спасовали"}
                  </p>
                  <p>Правильный ответ: {hand.result.correctAnswer}</p>
                  <p>
                    Победители:{" "}
                    {hand.result.winnerIds
                      .map((winnerId) => state?.players.find((player) => player.id === winnerId)?.name ?? "—")
                      .join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>После запуска игры здесь появится активный вопрос.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Банк вопросов</p>
        <h2>Все добавленные вопросы</h2>
        <div className="stack">
          {(state?.questions ?? []).map((item, index) => (
            <article className="questionCard" key={item.id}>
              <p className="questionMeta">#{index + 1}</p>
              <strong>{item.text}</strong>
              <p>
                Ответ: {item.answer} • Подсказки: {item.hints[0]} / {item.hints[1]}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function renderPhase(phase: string, revealedHints: number) {
  if (phase === "question") {
    return revealedHints === 0 ? "вопрос" : "вопрос перед ставкой";
  }

  if (phase === "hint") {
    return revealedHints === 1 ? "подсказка 1" : "подсказка 2";
  }

  if (phase === "betting") {
    return `ставки после этапа ${revealedHints}`;
  }

  if (phase === "showdown") {
    return "вскрытие";
  }

  if (phase === "finished") {
    return "игра завершена";
  }

  return "лобби";
}
