"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useGameState } from "@/components/use-game-state";

export function HostDashboard() {
  const { state, error, hostAction, isPending, refresh } = useGameState("host");
  const [questionForm, setQuestionForm] = useState({
    text: "",
    answer: "",
    hint1: "",
    hint2: "",
  });
  const [formError, setFormError] = useState("");

  const hand = state?.currentHand ?? null;
  const question =
    state && state.currentQuestionIndex >= 0 ? state.questions[state.currentQuestionIndex] : null;
  const answersCount = hand ? Object.keys(hand.submittedAnswers).length : 0;

  async function handleAddQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const formData = new FormData(event.currentTarget);
    formData.set("action", "add-question");
    formData.set("text", questionForm.text);
    formData.set("answer", questionForm.answer);
    formData.set("hint1", questionForm.hint1);
    formData.set("hint2", questionForm.hint2);

    const response = await fetch("/api/host", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as
      | { ok: true; data: unknown }
      | { ok: false; error: string };

    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }

    setQuestionForm({
      text: "",
      answer: "",
      hint1: "",
      hint2: "",
    });
    event.currentTarget.reset();
    await refresh();
  }

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Host Console</p>
          <h1>Game Master</h1>
        </div>
        <Link className="ghostButton" href="/">
          Home
        </Link>
      </div>

      <section className="grid twoColumns">
        <div className="panel">
          <p className="eyebrow">Game Controls</p>
          <h2>Live Status</h2>
          {state ? (
            <div className="stack">
              <p className="statusLine">
                Phase: <strong>{renderPhase(state.phase, hand?.revealedHints ?? 0)}</strong>
              </p>
              <p className="statusLine">
                Players at table: <strong>{state.players.length}</strong>
              </p>
              <p className="statusLine">
                Answers submitted: <strong>{answersCount}</strong>
              </p>
              <p className="statusLine">
                Pot: <strong>{hand?.pot ?? 0}</strong>
              </p>
              <p className="statusMessage">{state.message}</p>
            </div>
          ) : (
            <p>Loading the table...</p>
          )}

          <div className="buttonRow">
            <button className="primaryButton" disabled={!state || isPending} onClick={() => void hostAction("start-game")}>
              Start game
            </button>
            <button
              className="secondaryButton"
              disabled={!hand || state?.phase === "decision" || hand.revealedHints >= 2}
              onClick={() => void hostAction("reveal-hint")}
            >
              Reveal next hint
            </button>
            <button
              className="secondaryButton"
              disabled={!hand || state?.phase === "decision" || hand.revealedHints < 2 || hand.result !== null}
              onClick={() => void hostAction("showdown")}
            >
              Reveal correct answer
            </button>
            <button
              className="secondaryButton"
              disabled={!hand || hand.result === null}
              onClick={() => void hostAction("next-question")}
            >
              Next question
            </button>
            <button className="secondaryButton" disabled={!state?.players.length} onClick={() => void hostAction("end-game")}>
              End game
            </button>
            <button className="dangerButton" onClick={() => void hostAction("reset-game")}>
              Reset table
            </button>
          </div>

          {error ? <p className="errorText">{error}</p> : null}
        </div>

        <div className="panel">
          <p className="eyebrow">Question Builder</p>
          <h2>Add a new round</h2>
          <form className="form" onSubmit={handleAddQuestion}>
            <label className="field">
              <span>Question</span>
              <textarea
                name="text"
                value={questionForm.text}
                onChange={(event) => setQuestionForm((current) => ({ ...current, text: event.target.value }))}
                rows={4}
                placeholder="How many minutes are there in a day?"
              />
            </label>
            <div className="grid compactGrid">
              <label className="field">
                <span>Correct answer</span>
                <input
                  name="answer"
                  type="number"
                  value={questionForm.answer}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, answer: event.target.value }))}
                  placeholder="1440"
                />
              </label>
              <label className="field">
                <span>Question image</span>
                <input name="questionImage" type="file" accept="image/*" />
              </label>
              <div className="field helperCard">
                <span>Rule</span>
                <p>Each time a player taps Continue, 1 point goes into the pot automatically.</p>
              </div>
            </div>
            <div className="grid compactGrid">
              <label className="field">
                <span>Hint 1 text</span>
                <input
                  name="hint1"
                  value={questionForm.hint1}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, hint1: event.target.value }))}
                  placeholder="It is more than one thousand."
                />
              </label>
              <label className="field">
                <span>Hint 1 image</span>
                <input name="hint1Image" type="file" accept="image/*" />
              </label>
              <label className="field">
                <span>Hint 2 text</span>
                <input
                  name="hint2"
                  value={questionForm.hint2}
                  onChange={(event) => setQuestionForm((current) => ({ ...current, hint2: event.target.value }))}
                  placeholder="It divides cleanly by sixty."
                />
              </label>
            </div>
            <label className="field">
              <span>Hint 2 image</span>
              <input name="hint2Image" type="file" accept="image/*" />
            </label>
            <button className="primaryButton" type="submit">
              Save question
            </button>
            {formError ? <p className="errorText">{formError}</p> : null}
          </form>
        </div>
      </section>

      <section className="grid twoColumns">
        <div className="panel">
          <p className="eyebrow">Scores</p>
          <h2>Players</h2>
          <div className="tableList">
            {(state?.players ?? []).map((player) => {
              const submitted = hand?.submittedAnswers[player.id];
              const contribution = hand?.contributions[player.id] ?? 0;
              const folded = hand?.foldedPlayerIds.includes(player.id);
              const payout = hand?.result?.awarded[player.id] ?? 0;
              return (
                <article className="tableRow" key={player.id}>
                  <div>
                    <strong>{player.name}</strong>
                    <p>
                      Score: {player.stack}
                    </p>
                  </div>
                  <div className="alignRight">
                    <p>Answer: {submitted ?? "—"}</p>
                    <p>Committed: {contribution}</p>
                    <p>
                      {folded ? "Folded" : "Still in"}
                      {payout > 0 ? ` • +${payout}` : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <p className="eyebrow">Current Round</p>
          <h2>{question?.text ?? "No round running yet"}</h2>
          {question && hand ? (
            <div className="stack">
              <RoundMediaCard
                label="Question"
                text={question.text}
                imageUrl={question.imageUrl}
              />
              <RoundMediaCard
                label="Hint 1"
                text={question.hints[0].text}
                imageUrl={question.hints[0].imageUrl}
                hidden={hand.revealedHints < 1}
              />
              <RoundMediaCard
                label="Hint 2"
                text={question.hints[1].text}
                imageUrl={question.hints[1].imageUrl}
                hidden={hand.revealedHints < 2}
              />
              {hand.result ? (
                <div className="resultBox">
                  <p>Correct answer: {hand.result.correctAnswer}</p>
                  <p>
                    {hand.result.reason === "all-folded"
                      ? "All players folded. No winner for this round."
                      : `Winner${hand.result.winnerIds.length > 1 ? "s" : ""}: ${
                          hand.result.winnerIds
                            .map((winnerId) => state?.players.find((player) => player.id === winnerId)?.name ?? "—")
                            .join(", ")
                        }`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p>The current question and media will appear here.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Question Bank</p>
        <h2>All rounds</h2>
        <div className="stack">
          {(state?.questions ?? []).map((item, index) => (
            <article className="questionCard" key={item.id}>
              <p className="questionMeta">#{index + 1}</p>
              <strong>{item.text}</strong>
              <p>
                Answer: {item.answer} • Hints: {item.hints[0].text} / {item.hints[1].text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function RoundMediaCard({
  label,
  text,
  imageUrl,
  hidden,
}: {
  label: string;
  text: string;
  imageUrl: string | null;
  hidden?: boolean;
}) {
  return (
    <article className={`mediaCard ${hidden ? "mediaCardHidden" : ""}`}>
      <p className="questionMeta">{label}</p>
      <p>{hidden ? "Hidden until revealed." : text}</p>
      {!hidden && imageUrl ? (
        <div className="imageFrame">
          <Image alt={label} className="stageImage" fill sizes="(max-width: 900px) 100vw, 480px" src={imageUrl} unoptimized />
        </div>
      ) : null}
    </article>
  );
}

function renderPhase(phase: string, revealedHints: number) {
  if (phase === "question") {
    if (revealedHints === 0) {
      return "Question";
    }
    if (revealedHints === 1) {
      return "Hint 1 waiting";
    }
    if (revealedHints === 2) {
      return "Hint 2 waiting";
    }
  }

  if (phase === "decision") {
    if (revealedHints === 0) {
      return "Question decision";
    }
    if (revealedHints === 1) {
      return "Hint 1 decision";
    }
    if (revealedHints === 2) {
      return "Hint 2 decision";
    }
  }

  if (phase === "showdown") {
    return "Showdown";
  }

  if (phase === "finished") {
    return "Finished";
  }

  return "Lobby";
}
