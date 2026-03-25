"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useGameState } from "@/components/use-game-state";

const storageKey = "poker-quiz-player-id";

export function PlayerDashboard() {
  const { state, error, playerAction } = useGameState("player");
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
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
  const hasSubmittedAnswer = Boolean(hand && me && hand.submittedAnswers[me.id] !== undefined);
  const hasFolded = Boolean(hand && me && hand.foldedPlayerIds.includes(me.id));
  const hasChosenThisStage = Boolean(hand && me && hand.decisionResponses[me.id]);
  const currentPrompt = getCurrentPrompt(question, hand?.currentDecisionStage ?? null, hand?.revealedHints ?? 0);

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

  async function makeDecision(choice: "continue" | "fold") {
    if (!playerId) {
      return;
    }

    await playerAction("decision", {
      playerId,
      choice,
    });
  }

  return (
    <main className="playerShell">
      <div className="topbar compactTopbar">
        <div>
          <p className="eyebrow">Player View</p>
          <h1>Play</h1>
        </div>
        <Link className="ghostButton" href="/">
          Home
        </Link>
      </div>

      {!me ? (
        <section className="panel joinPanel">
          <p className="eyebrow">Join Table</p>
          <h2>Enter your name</h2>
          <p>Room code: <strong>{state?.joinCode ?? "QUIZ"}</strong></p>
          <form className="inlineForm" onSubmit={handleJoin}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Player name"
            />
            <button className="primaryButton" type="submit">
              Join
            </button>
          </form>
          {error ? <p className="errorText">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="mainActionCard">
            <div className="playerMetaBar">
              <div>
                <p className="eyebrow">You</p>
                <h2>{me.name}</h2>
              </div>
              <div className="alignRight">
                <p className="eyebrow">Score</p>
                <h2>{me.stack}</h2>
              </div>
            </div>

            <div className="actionStage">
              <p className="eyebrow">{renderStageLabel(state?.phase ?? "lobby", hand?.currentDecisionStage ?? null, hand?.revealedHints ?? 0)}</p>
              <h3>{currentPrompt.title}</h3>
              <p className="leadText">{currentPrompt.text}</p>
              {currentPrompt.imageUrl ? (
                <div className="imageFrame heroImageFrame">
                  <Image
                    alt={currentPrompt.title}
                    className="heroImage"
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    src={currentPrompt.imageUrl}
                    unoptimized
                  />
                </div>
              ) : null}
            </div>

            {state?.phase === "finished" ? (
              <div className="stack">
                <p className="statusMessage">{state.message}</p>
                <div className="tableList">
                  {state.players
                    .slice()
                    .sort((left, right) => right.stack - left.stack)
                    .map((player) => (
                      <article className="tableRow" key={player.id}>
                        <div>
                          <strong>{player.name}</strong>
                          <p>Final score</p>
                        </div>
                        <div className="alignRight">
                          <p>{player.stack}</p>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            ) : question && hand && me && state?.phase !== "showdown" ? (
              <>
                {!hasSubmittedAnswer ? (
                  <form className="stack" onSubmit={handleSubmitAnswer}>
                    <label className="field">
                      <span>Your numeric answer</span>
                      <input
                        type="number"
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder="Type a number"
                      />
                    </label>
                    <button className="primaryButton wideButton" type="submit">
                      Submit answer
                    </button>
                  </form>
                ) : state?.phase === "decision" && !hasFolded ? (
                  <div className="stack">
                    <p className="subtleText">
                      Continue costs {state.continueCost} point and keeps you in the round.
                    </p>
                    {hasChosenThisStage ? (
                      <p className="statusMessage">Choice locked. Waiting for the other players.</p>
                    ) : (
                      <div className="buttonRow mobileActions">
                        <button className="primaryButton wideButton" onClick={() => void makeDecision("continue")}>
                          Continue for {state.continueCost}
                        </button>
                        <button className="dangerButton wideButton" onClick={() => void makeDecision("fold")}>
                          Fold now
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="statusMessage">
                    {hasFolded
                      ? "You folded this round."
                      : "Answer locked. Waiting for the host or other players."}
                  </p>
                )}
              </>
            ) : null}

            {state?.phase === "showdown" && question && hand ? (
              <div className="stack">
                <div className="resultBox">
                  <p>Correct answer: {hand.result?.correctAnswer}</p>
                  <p>
                    {hand.result?.reason === "all-folded"
                      ? "All players folded. No winner this round."
                      : `Winner${hand.result && hand.result.winnerIds.length > 1 ? "s" : ""}: ${
                          hand.result?.winnerIds
                            .map((winnerId) => state.players.find((player) => player.id === winnerId)?.name ?? "—")
                            .join(", ")
                        }`}
                  </p>
                </div>
                <div className="tableList">
                  {state.players.map((player) => (
                    <article className="tableRow" key={player.id}>
                      <div>
                        <strong>{player.name}</strong>
                        <p>{hand.foldedPlayerIds.includes(player.id) ? "Folded" : "Reached the end"}</p>
                      </div>
                      <div className="alignRight">
                        <p>Answer: {hand.submittedAnswers[player.id] ?? "—"}</p>
                        <p>Score: {player.stack}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <p className="errorText">{error}</p> : null}
          </section>

          <section className="panel compactPanel">
            <p className="eyebrow">Table Scores</p>
            <div className="scoreStrip">
              {(state?.players ?? []).map((player) => (
                <article className="scorePill" key={player.id}>
                  <strong>{player.name}</strong>
                  <span>{player.stack}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function getCurrentPrompt(
  question:
    | {
        text: string;
        imageUrl: string | null;
        hints: [{ text: string; imageUrl: string | null }, { text: string; imageUrl: string | null }];
      }
    | null,
  currentDecisionStage: number | null,
  revealedHints: number,
) {
  if (!question) {
    return {
      title: "Waiting for host",
      text: "The host has not started the next round yet.",
      imageUrl: null,
    };
  }

  if (currentDecisionStage === 1 || (currentDecisionStage === null && revealedHints === 1)) {
    return {
      title: "Hint 1",
      text: question.hints[0].text,
      imageUrl: question.hints[0].imageUrl,
    };
  }

  if (currentDecisionStage === 2 || (currentDecisionStage === null && revealedHints >= 2)) {
    return {
      title: "Hint 2",
      text: question.hints[1].text,
      imageUrl: question.hints[1].imageUrl,
    };
  }

  return {
    title: "Question",
    text: question.text,
    imageUrl: question.imageUrl,
  };
}

function renderStageLabel(phase: string, currentDecisionStage: number | null, revealedHints: number) {
  if (phase === "showdown") {
    return "Round Result";
  }

  if (phase === "decision") {
    if (currentDecisionStage === 0) {
      return "Question Decision";
    }
    if (currentDecisionStage === 1) {
      return "Hint 1 Decision";
    }
    if (currentDecisionStage === 2) {
      return "Hint 2 Decision";
    }
  }

  if (revealedHints === 1) {
    return "Hint 1";
  }

  if (revealedHints >= 2) {
    return "Hint 2";
  }

  return "Question";
}
