import { GameState, HandState, Player, Question, ShowdownResult } from "@/lib/game-types";

export class GameError extends Error {}

const DEFAULT_JOIN_CODE = "QUIZ";
const DEFAULT_STACK = 10;
const CONTINUE_COST = 1;

export function createInitialState(): GameState {
  return {
    id: crypto.randomUUID(),
    phase: "lobby",
    joinCode: DEFAULT_JOIN_CODE,
    startingStack: DEFAULT_STACK,
    continueCost: CONTINUE_COST,
    questions: [],
    players: [],
    currentQuestionIndex: -1,
    currentHand: null,
    message: "Add questions, let players join, then start the game.",
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeState(state: GameState, role: "host" | "player"): GameState {
  if (role === "host") {
    return state;
  }

  return {
    ...state,
    questions: state.questions.map((question, index) => ({
      ...question,
      answer:
        state.currentHand?.questionIndex === index && state.currentHand.result
          ? question.answer
          : NaN,
    })),
  };
}

export function getCurrentQuestion(state: GameState): Question | null {
  if (state.currentQuestionIndex < 0) {
    return null;
  }

  return state.questions[state.currentQuestionIndex] ?? null;
}

export function addQuestion(
  state: GameState,
  payload: {
    text: string;
    answer: number;
    imageUrl?: string | null;
    hint1: string;
    hint1ImageUrl?: string | null;
    hint2: string;
    hint2ImageUrl?: string | null;
  },
) {
  const text = payload.text.trim();
  const hint1 = payload.hint1.trim();
  const hint2 = payload.hint2.trim();

  if (!text || !hint1 || !hint2 || !Number.isFinite(payload.answer)) {
    throw new GameError("Question text, both hints, and a numeric answer are required.");
  }

  state.questions.push({
    id: crypto.randomUUID(),
    text,
    answer: payload.answer,
    imageUrl: payload.imageUrl ?? null,
    hints: [
      {
        text: hint1,
        imageUrl: payload.hint1ImageUrl ?? null,
      },
      {
        text: hint2,
        imageUrl: payload.hint2ImageUrl ?? null,
      },
    ],
  });
  touch(state, `${state.questions.length} questions ready.`);
}

export function joinPlayer(state: GameState, payload: { name: string }) {
  const name = payload.name.trim();

  if (!name) {
    throw new GameError("Player name is required.");
  }

  const existing = state.players.find(
    (player) => player.name.toLowerCase() === name.toLowerCase(),
  );

  if (existing) {
    if (existing.isEliminated) {
      throw new GameError("That player has already been eliminated in this game.");
    }

    return existing;
  }

  const player: Player = {
    id: crypto.randomUUID(),
    name,
    stack: state.startingStack,
    isEliminated: false,
    joinedAt: new Date().toISOString(),
  };

  state.players.push(player);
  touch(state, `${player.name} joined the table.`);
  return player;
}

export function startGame(state: GameState) {
  if (state.questions.length === 0) {
    throw new GameError("Add at least one question first.");
  }

  if (state.players.length < 2) {
    throw new GameError("At least two players are required to start.");
  }

  for (const player of state.players) {
    player.stack = state.startingStack;
    player.isEliminated = false;
  }

  state.currentQuestionIndex = -1;
  state.currentHand = null;
  startNextQuestion(state, true);
}

export function startNextQuestion(state: GameState, isGameStart = false) {
  const alivePlayers = getAlivePlayers(state);

  if (alivePlayers.length <= 1) {
    state.phase = "finished";
    state.currentHand = null;
    touch(
      state,
      alivePlayers[0] ? `${alivePlayers[0].name} wins the game.` : "The game ended.",
    );
    return;
  }

  const nextIndex = state.currentQuestionIndex + 1;

  if (!state.questions[nextIndex]) {
    state.phase = "finished";
    state.currentHand = null;
    const leader = [...alivePlayers].sort((a, b) => b.stack - a.stack)[0];
    touch(state, `No questions left. Chip leader: ${leader.name}.`);
    return;
  }

  state.currentQuestionIndex = nextIndex;
  state.currentHand = {
    questionId: state.questions[nextIndex].id,
    questionIndex: nextIndex,
    revealedHints: 0,
    submittedAnswers: {},
    foldedPlayerIds: [],
    pot: 0,
    contributions: {},
    currentDecisionStage: null,
    decisionResponses: {},
    result: null,
  };
  state.phase = "question";
  touch(
    state,
    isGameStart ? "Game started. Players can submit answers." : "Next question is live.",
  );
}

export function submitAnswer(state: GameState, payload: { playerId: string; answer: number }) {
  const hand = requireCurrentHand(state);
  const player = requirePlayer(state, payload.playerId);

  if (state.phase !== "question") {
    throw new GameError("Answers are closed right now.");
  }

  if (player.isEliminated) {
    throw new GameError("This player has already been eliminated.");
  }

  if (!Number.isFinite(payload.answer)) {
    throw new GameError("Answer must be a number.");
  }

  if (hand.submittedAnswers[player.id] !== undefined) {
    throw new GameError("Answer already submitted.");
  }

  hand.submittedAnswers[player.id] = payload.answer;

  if (allAlivePlayersAnswered(state)) {
    openDecisionStage(state, 0);
    return;
  }

  touch(state, `${player.name} submitted an answer.`);
}

export function revealHint(state: GameState) {
  const hand = requireCurrentHand(state);

  if (state.phase === "decision") {
    throw new GameError("Wait until players finish the current continue-or-fold choice.");
  }

  if (!allAlivePlayersAnswered(state)) {
    throw new GameError("Wait until every active player submits an answer.");
  }

  if (hand.result) {
    throw new GameError("This round is already complete.");
  }

  if (hand.revealedHints >= 2) {
    throw new GameError("Both hints are already revealed.");
  }

  hand.revealedHints += 1;
  openDecisionStage(state, hand.revealedHints);
}

export function revealShowdown(state: GameState) {
  const hand = requireCurrentHand(state);
  const question = getCurrentQuestion(state);

  if (!question) {
    throw new GameError("No active question.");
  }

  if (state.phase === "decision") {
    throw new GameError("Wait until players finish the current continue-or-fold choice.");
  }

  if (hand.revealedHints < 2) {
    throw new GameError("Reveal both hints before opening the answer.");
  }

  if (hand.result) {
    throw new GameError("Showdown already happened.");
  }

  const contenders = getContenders(state);

  if (contenders.length === 0) {
    throw new GameError("No players left in the round.");
  }

  const distances = contenders.map((player) => ({
    player,
    distance: Math.abs(hand.submittedAnswers[player.id] - question.answer),
  }));
  const closestDistance = Math.min(...distances.map((item) => item.distance));
  const winners = distances
    .filter((item) => item.distance === closestDistance)
    .map((item) => item.player);

  hand.result = awardPot(state, winners, closestDistance, question.answer, "closest-answer");
  state.phase = "showdown";
  eliminateBrokePlayers(state);
  touch(
    state,
    winners.length === 1
      ? `${winners[0].name} wins the round.`
      : `${winners.map((winner) => winner.name).join(", ")} split the round.`,
  );
}

export function resetGame(state: GameState) {
  const fresh = createInitialState();
  state.id = fresh.id;
  state.phase = fresh.phase;
  state.joinCode = fresh.joinCode;
  state.startingStack = fresh.startingStack;
  state.continueCost = fresh.continueCost;
  state.questions = [];
  state.players = [];
  state.currentQuestionIndex = fresh.currentQuestionIndex;
  state.currentHand = fresh.currentHand;
  state.message = fresh.message;
  state.updatedAt = fresh.updatedAt;
}

export function applyPlayerDecision(
  state: GameState,
  payload: { playerId: string; choice: "continue" | "fold" },
) {
  const hand = requireCurrentHand(state);
  const player = requirePlayer(state, payload.playerId);

  if (state.phase !== "decision" || hand.currentDecisionStage === null) {
    throw new GameError("There is no active continue-or-fold decision right now.");
  }

  if (player.isEliminated) {
    throw new GameError("This player has already been eliminated.");
  }

  if (hand.submittedAnswers[player.id] === undefined) {
    throw new GameError("Submit an answer first.");
  }

  if (hand.foldedPlayerIds.includes(player.id)) {
    throw new GameError("This player already folded.");
  }

  if (hand.decisionResponses[player.id]) {
    throw new GameError("Decision already submitted for this stage.");
  }

  if (payload.choice === "continue") {
    if (player.stack < state.continueCost) {
      throw new GameError("Not enough points to continue.");
    }
    player.stack -= state.continueCost;
    hand.pot += state.continueCost;
    hand.contributions[player.id] = (hand.contributions[player.id] ?? 0) + state.continueCost;
    hand.decisionResponses[player.id] = "continue";
  } else {
    hand.foldedPlayerIds.push(player.id);
    hand.decisionResponses[player.id] = "fold";
  }

  if (getContenders(state).length <= 1) {
    awardLastStanding(state);
    return;
  }

  if (allDecisionMakersActed(state)) {
    closeDecisionStage(state);
  } else {
    touch(state, `${player.name} made a choice.`);
  }
}

function openDecisionStage(state: GameState, stageIndex: number) {
  const hand = requireCurrentHand(state);

  hand.currentDecisionStage = stageIndex;
  hand.decisionResponses = {};
  state.phase = "decision";

  if (stageIndex === 0) {
    touch(state, "Answers are locked. Players can now continue or fold.");
    return;
  }

  touch(state, `Hint ${stageIndex} is live. Players can continue or fold.`);
}

function closeDecisionStage(state: GameState) {
  const hand = requireCurrentHand(state);
  hand.currentDecisionStage = null;
  hand.decisionResponses = {};
  state.phase = "question";

  if (hand.revealedHints === 0) {
    touch(state, "Question phase complete. Host can reveal hint 1.");
    return;
  }

  if (hand.revealedHints === 1) {
    touch(state, "Hint 1 phase complete. Host can reveal hint 2.");
    return;
  }

  touch(state, "Hint 2 phase complete. Host can reveal the correct answer.");
}

function awardLastStanding(state: GameState) {
  const hand = requireCurrentHand(state);
  const winners = getContenders(state);

  if (winners.length !== 1) {
    throw new GameError("Last-standing resolution requires exactly one contender.");
  }

  hand.result = awardPot(
    state,
    winners,
    0,
    getCurrentQuestion(state)?.answer ?? 0,
    "last-player-standing",
  );
  hand.currentDecisionStage = null;
  hand.decisionResponses = {};
  state.phase = "showdown";
  eliminateBrokePlayers(state);
  touch(state, `${winners[0].name} wins the round by staying in alone.`);
}

function awardPot(
  state: GameState,
  winners: Player[],
  closestDistance: number,
  correctAnswer: number,
  reason: ShowdownResult["reason"],
) {
  const hand = requireCurrentHand(state);
  const awarded: Record<string, number> = {};
  const splitBase = Math.floor(hand.pot / winners.length);
  let remainder = hand.pot % winners.length;

  for (const winner of winners) {
    const payout = splitBase + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    winner.stack += payout;
    awarded[winner.id] = payout;
  }

  return {
    winnerIds: winners.map((winner) => winner.id),
    closestDistance,
    correctAnswer,
    reason,
    awarded,
  };
}

function allAlivePlayersAnswered(state: GameState) {
  const hand = requireCurrentHand(state);
  return getAlivePlayers(state).every((player) => hand.submittedAnswers[player.id] !== undefined);
}

function allDecisionMakersActed(state: GameState) {
  const hand = requireCurrentHand(state);
  const decisionMakers = getDecisionMakers(state);
  return decisionMakers.every((player) => hand.decisionResponses[player.id] !== undefined);
}

function getAlivePlayers(state: GameState) {
  return state.players.filter((player) => !player.isEliminated);
}

function getContenders(state: GameState) {
  const hand = requireCurrentHand(state);
  return getAlivePlayers(state).filter(
    (player) =>
      hand.submittedAnswers[player.id] !== undefined && !hand.foldedPlayerIds.includes(player.id),
  );
}

function getDecisionMakers(state: GameState) {
  return getContenders(state);
}

function requireCurrentHand(state: GameState): HandState {
  if (!state.currentHand) {
    throw new GameError("There is no active hand.");
  }

  return state.currentHand;
}

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);

  if (!player) {
    throw new GameError("Player not found.");
  }

  return player;
}

function eliminateBrokePlayers(state: GameState) {
  for (const player of state.players) {
    if (player.stack <= 0) {
      player.isEliminated = true;
    }
  }
}

function touch(state: GameState, message: string) {
  state.message = message;
  state.updatedAt = new Date().toISOString();
}
