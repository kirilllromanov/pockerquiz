"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { useGameState } from "@/components/use-game-state";

const storageKey = "poker-quiz-player-id";

export function PlayerDashboard() {
  const { state, error, playerAction } = useGameState("player");
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [raiseTo, setRaiseTo] = useState("");
  const [playerId, setPlayerId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(storageKey) ?? "";
  });

  const me = useMemo(
    () => state?.players.find((player) => player.id === playerId) ?? null,
    [playerId, state?.players],
  );
  const hand = state?.currentHand ?? null;
  const question =
    state && state.currentQuestionIndex >= 0 ? state.questions[state.currentQuestionIndex] : null;
  const myRoundContribution = hand && me ? hand.roundContributions[me.id] ?? 0 : 0;
  const toCall = hand ? Math.max(hand.currentBet - myRoundContribution, 0) : 0;
  const hasSubmittedAnswer = Boolean(hand && me && hand.submittedAnswers[me.id] !== undefined);
  const isFolded = Boolean(hand && me && hand.foldedPlayerIds.includes(me.id));

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await playerAction("join", { name });
    if (!result?.playerId) {
      return;
    }
    window.localStorage.setItem(storageKey, result.playerId);
    setPlayerId(result.playerId);
    setName("");
  }

  async function handleSubmitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerId) {
      return;
    }
    await playerAction("submit-answer", {
      playerId,
      answer: Number(answer),
    });
    setAnswer("");
  }

  async function makeMove(move: "check" | "call" | "raise" | "fold") {
    if (!playerId) {
      return;
    }

    await playerAction("bet-action", {
      playerId,
      move,
      amount: move === "raise" ? Number(raiseTo) : undefined,
    });

    if (move === "raise") {
      setRaiseTo("");
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Player View</p>
          <h1>Игрок</h1>
        </div>
        <Link className="ghostButton" href="/">
          На главную
        </Link>
      </div>

      {!me ? (
        <section className="panel joinPanel">
          <p className="eyebrow">Подключение к столу</p>
          <h2>Войти в игру</h2>
          <p>Код комнаты сейчас фиксированный: <strong>{state?.joinCode ?? "QUIZ"}</strong>.</p>
          <form className="inlineForm" onSubmit={handleJoin}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Имя игрока"
            />
            <button className="primaryButton" type="submit">
              Подключиться
            </button>
          </form>
          {error ? <p className="errorText">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="grid twoColumns">
            <div className="panel">
              <p className="eyebrow">Мой стол</p>
              <h2>{me.name}</h2>
              <div className="stack">
                <p className="statusLine">
                  Баланс: <strong>{me.stack}</strong>
                </p>
                <p className="statusLine">
                  Статус: <strong>{me.isEliminated ? "выбыл" : isFolded ? "пас" : "в игре"}</strong>
                </p>
                <p className="statusLine">
                  Фаза: <strong>{renderPhase(state?.phase ?? "lobby", hand?.revealedHints ?? 0)}</strong>
                </p>
                <p className="statusMessage">{state?.message}</p>
              </div>
            </div>

            <div className="panel">
              <p className="eyebrow">Стол</p>
              <h2>Все игроки</h2>
              <div className="tableList">
                {(state?.players ?? []).map((player) => (
                  <article className="tableRow" key={player.id}>
                    <div>
                      <strong>{player.name}</strong>
                      <p>{player.isEliminated ? "Выбыл" : "За столом"}</p>
                    </div>
                    <div className="alignRight">
                      <p>{player.stack}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid twoColumns">
            <div className="panel">
              <p className="eyebrow">Вопрос</p>
              <h2>{question?.text ?? "Ожидание старта игры"}</h2>
              {question && hand ? (
                <div className="stack">
                  <p className="statusLine">
                    Подсказка 1: <strong>{hand.revealedHints >= 1 ? question.hints[0] : "скрыта"}</strong>
                  </p>
                  <p className="statusLine">
                    Подсказка 2: <strong>{hand.revealedHints >= 2 ? question.hints[1] : "скрыта"}</strong>
                  </p>
                  {hand.result ? (
                    <div className="resultBox">
                      <p>Правильный ответ: {hand.result.correctAnswer}</p>
                      <p>
                        Твой ответ: {me ? hand.submittedAnswers[me.id] ?? "—" : "—"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>Ведущий ещё не начал игру.</p>
              )}
            </div>

            <div className="panel">
              <p className="eyebrow">Ответ</p>
              <h2>Отправить число</h2>
              <form className="inlineForm" onSubmit={handleSubmitAnswer}>
                <input
                  type="number"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Ваш вариант"
                  disabled={!question || hasSubmittedAnswer || me.isEliminated}
                />
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={!question || hasSubmittedAnswer || me.isEliminated}
                >
                  Отправить
                </button>
              </form>
              <p className="subtleText">
                {hasSubmittedAnswer
                  ? "Ответ принят. Ждите ставок или подсказки."
                  : "После отправки ответ нельзя изменить."}
              </p>
            </div>
          </section>

          <section className="panel">
            <p className="eyebrow">Раунд ставок</p>
            <h2>Действия игрока</h2>
            {state?.phase === "betting" && hand && !me.isEliminated && !isFolded ? (
              <div className="stack">
                <p className="statusLine">
                  Банк: <strong>{hand.pot}</strong>
                </p>
                <p className="statusLine">
                  Текущая ставка: <strong>{hand.currentBet}</strong>
                </p>
                <p className="statusLine">
                  Нужно доставить: <strong>{toCall}</strong>
                </p>
                <div className="buttonRow">
                  <button className="secondaryButton" disabled={toCall !== 0} onClick={() => void makeMove("check")}>
                    Чек
                  </button>
                  <button className="secondaryButton" disabled={toCall === 0} onClick={() => void makeMove("call")}>
                    Колл
                  </button>
                  <input
                    type="number"
                    value={raiseTo}
                    onChange={(event) => setRaiseTo(event.target.value)}
                    placeholder={`минимум ${hand.currentBet + (state?.minRaise ?? 0)}`}
                  />
                  <button className="primaryButton" onClick={() => void makeMove("raise")}>
                    Рейз
                  </button>
                  <button className="dangerButton" onClick={() => void makeMove("fold")}>
                    Пас
                  </button>
                </div>
              </div>
            ) : (
              <p>Сейчас ставок нет. Дождитесь сигнала ведущего.</p>
            )}
            {error ? <p className="errorText">{error}</p> : null}
          </section>
        </>
      )}
    </main>
  );
}

function renderPhase(phase: string, revealedHints: number) {
  if (phase === "question") {
    return revealedHints === 0 ? "вопрос" : "вопрос";
  }

  if (phase === "hint") {
    return revealedHints === 1 ? "первая подсказка" : "вторая подсказка";
  }

  if (phase === "betting") {
    return "ставки";
  }

  if (phase === "showdown") {
    return "вскрытие";
  }

  if (phase === "finished") {
    return "игра завершена";
  }

  return "лобби";
}
