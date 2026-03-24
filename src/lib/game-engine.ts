import { GameState, HandState, Player, Question, ShowdownResult } from "@/lib/game-types";

export class GameError extends Error {}

const DEFAULT_JOIN_CODE = "QUIZ";
const DEFAULT_STACK = 1000;
const DEFAULT_MIN_RAISE = 50;

export function createInitialState(): GameState {
  return {
    id: crypto.randomUUID(),
    phase: "lobby",
    joinCode: DEFAULT_JOIN_CODE,
    startingStack: DEFAULT_STACK,
    minRaise: DEFAULT_MIN_RAISE,
    questions: [],
    players: [],
    currentQuestionIndex: -1,
    currentHand: null,
    message: "Добавьте вопросы, затем подключите игроков и запускайте игру.",
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeState(state: GameState, role: "host" | "player"): GameState {
  if (role === "host") {
    return state;
  }

  return {
    ...state,
    questions: state.questions.map((question, index) => {
      const shouldRevealAnswer =
        state.currentHand?.questionIndex === index && state.currentHand.result !== null;

      return {
        ...question,
        answer: shouldRevealAnswer ? question.answer : NaN,
      };
    }),
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
  payload: { text: string; answer: number; hint1: string; hint2: string },
) {
  const text = payload.text.trim();
  const hint1 = payload.hint1.trim();
  const hint2 = payload.hint2.trim();

  if (!text || !hint1 || !hint2 || !Number.isFinite(payload.answer)) {
    throw new GameError("Нужны текст вопроса, две подсказки и числовой правильный ответ.");
  }

  state.questions.push({
    id: crypto.randomUUID(),
    text,
    answer: payload.answer,
    hints: [hint1, hint2],
  });
  touch(state, `Вопросов в банке: ${state.questions.length}.`);
}

export function joinPlayer(state: GameState, payload: { name: string }) {
  const name = payload.name.trim();

  if (!name) {
    throw new GameError("У игрока должно быть имя.");
  }

  const existing = state.players.find(
    (player) => player.name.toLowerCase() === name.toLowerCase(),
  );

  if (existing) {
    if (existing.isEliminated) {
      throw new GameError("Игрок с таким именем уже выбыл из текущей игры.");
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
  touch(state, `${player.name} подключился к столу.`);
  return player;
}

export function startGame(state: GameState) {
  if (state.questions.length === 0) {
    throw new GameError("Сначала добавьте хотя бы один вопрос.");
  }

  if (state.players.length < 2) {
    throw new GameError("Для старта игры нужно минимум два игрока.");
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
      alivePlayers[0]
        ? `${alivePlayers[0].name} победил в игре.`
        : "Игра завершена без победителя.",
    );
    return;
  }

  const nextIndex = state.currentQuestionIndex + 1;

  if (!state.questions[nextIndex]) {
    state.phase = "finished";
    state.currentHand = null;
    const leader = [...alivePlayers].sort((a, b) => b.stack - a.stack)[0];
    touch(state, `Вопросы закончились. Лидер по фишкам: ${leader.name}.`);
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
    currentBet: 0,
    roundContributions: {},
    totalContributions: {},
    actedPlayerIds: [],
    bettingRound: 0,
    result: null,
  };
  state.phase = "question";
  touch(
    state,
    isGameStart
      ? "Игра запущена. Игроки отвечают на первый вопрос."
      : "Следующий вопрос открыт.",
  );
}

export function submitAnswer(state: GameState, payload: { playerId: string; answer: number }) {
  const hand = requireCurrentHand(state);
  const player = requirePlayer(state, payload.playerId);

  if (state.phase !== "question" && state.phase !== "hint") {
    throw new GameError("Сейчас нельзя отправлять ответы.");
  }

  if (player.isEliminated) {
    throw new GameError("Игрок уже выбыл.");
  }

  if (!Number.isFinite(payload.answer)) {
    throw new GameError("Ответ должен быть числом.");
  }

  if (hand.submittedAnswers[player.id] !== undefined) {
    throw new GameError("Ответ уже отправлен и больше не меняется.");
  }

  hand.submittedAnswers[player.id] = payload.answer;

  if (allAlivePlayersAnswered(state)) {
    touch(state, "Все ответы получены. Ведущий может запускать круг ставок.");
    return;
  }

  touch(state, `${player.name} отправил ответ.`);
}

export function startBettingRound(state: GameState) {
  const hand = requireCurrentHand(state);

  if (state.phase === "betting") {
    throw new GameError("Круг ставок уже идёт.");
  }

  if (hand.result) {
    throw new GameError("Этот вопрос уже завершён.");
  }

  if (!allAlivePlayersAnswered(state)) {
    throw new GameError("Сначала дождитесь ответов от всех активных игроков.");
  }

  const activePlayers = getBettingPlayers(state);

  if (activePlayers.length <= 1) {
    awardLastStanding(state);
    return;
  }

  hand.currentBet = 0;
  hand.roundContributions = {};
  hand.actedPlayerIds = [];
  hand.bettingRound += 1;
  state.phase = "betting";
  touch(state, `Запущен круг ставок №${hand.bettingRound}.`);
}

export function revealHint(state: GameState) {
  const hand = requireCurrentHand(state);

  if (state.phase === "betting") {
    throw new GameError("Сначала завершите текущий круг ставок.");
  }

  if (hand.revealedHints >= 2) {
    throw new GameError("Обе подсказки уже открыты.");
  }

  if (!allAlivePlayersAnswered(state)) {
    throw new GameError("Сначала дождитесь ответов от всех игроков.");
  }

  hand.revealedHints += 1;
  state.phase = "hint";
  touch(state, `Подсказка ${hand.revealedHints} открыта. Можно запускать следующий круг ставок.`);
}

export function revealShowdown(state: GameState) {
  const hand = requireCurrentHand(state);
  const question = getCurrentQuestion(state);

  if (!question) {
    throw new GameError("Нет активного вопроса.");
  }

  if (state.phase === "betting") {
    throw new GameError("Сначала завершите круг ставок.");
  }

  if (hand.result) {
    throw new GameError("Вскрытие уже выполнено.");
  }

  const contenders = getBettingPlayers(state);

  if (contenders.length === 0) {
    throw new GameError("Нет игроков для вскрытия.");
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
      ? `${winners[0].name} забирает банк.`
      : `${winners.map((winner) => winner.name).join(", ")} делят банк.`,
  );
}

export function resetGame(state: GameState) {
  const fresh = createInitialState();
  state.id = fresh.id;
  state.phase = fresh.phase;
  state.joinCode = fresh.joinCode;
  state.startingStack = fresh.startingStack;
  state.minRaise = fresh.minRaise;
  state.questions = [];
  state.players = [];
  state.currentQuestionIndex = fresh.currentQuestionIndex;
  state.currentHand = fresh.currentHand;
  state.message = fresh.message;
  state.updatedAt = fresh.updatedAt;
}

export function applyPlayerBetAction(
  state: GameState,
  payload: { playerId: string; action: "check" | "call" | "raise" | "fold"; amount?: number },
) {
  const hand = requireCurrentHand(state);
  const player = requirePlayer(state, payload.playerId);

  if (state.phase !== "betting") {
    throw new GameError("Ставки сейчас закрыты.");
  }

  if (player.isEliminated) {
    throw new GameError("Игрок уже выбыл.");
  }

  if (hand.foldedPlayerIds.includes(player.id)) {
    throw new GameError("Игрок уже спасовал.");
  }

  if (hand.submittedAnswers[player.id] === undefined) {
    throw new GameError("Сначала нужно отправить ответ.");
  }

  const currentContribution = hand.roundContributions[player.id] ?? 0;
  const toCall = hand.currentBet - currentContribution;

  switch (payload.action) {
    case "check": {
      if (toCall !== 0) {
        throw new GameError("Нельзя чекать, пока ставка не уравнена.");
      }
      markActed(hand, player.id);
      touch(state, `${player.name} сказал чек.`);
      break;
    }
    case "call": {
      if (toCall < 0) {
        throw new GameError("Состояние ставок повреждено.");
      }
      moveChips(state, player, hand, toCall);
      markActed(hand, player.id);
      touch(state, `${player.name} уравнял ставку.`);
      break;
    }
    case "raise": {
      const targetBet = payload.amount ?? 0;

      if (!Number.isInteger(targetBet) || targetBet < hand.currentBet + state.minRaise) {
        throw new GameError(
          `Рейз должен поднимать ставку минимум до ${hand.currentBet + state.minRaise}.`,
        );
      }

      const raiseBy = targetBet - currentContribution;
      moveChips(state, player, hand, raiseBy);
      hand.currentBet = targetBet;
      hand.actedPlayerIds = [player.id];
      touch(state, `${player.name} поднял ставку до ${targetBet}.`);
      break;
    }
    case "fold": {
      hand.foldedPlayerIds.push(player.id);
      markActed(hand, player.id);
      touch(state, `${player.name} спасовал.`);
      break;
    }
    default:
      throw new GameError("Неизвестное действие игрока.");
  }

  if (getBettingPlayers(state).length <= 1) {
    awardLastStanding(state);
    return;
  }

  if (state.phase === "betting" && isBettingRoundComplete(state)) {
    state.phase = hand.revealedHints > 0 ? "hint" : "question";
    touch(state, "Круг ставок завершён. Ведущий может открыть подсказку или перейти к вскрытию.");
  }
}

function awardLastStanding(state: GameState) {
  const hand = requireCurrentHand(state);
  const winners = getBettingPlayers(state);

  if (winners.length !== 1) {
    throw new GameError("Нельзя завершить раздачу без единственного активного игрока.");
  }

  hand.result = awardPot(state, winners, 0, getCurrentQuestion(state)?.answer ?? 0, "last-player-standing");
  state.phase = "showdown";
  eliminateBrokePlayers(state);
  touch(state, `${winners[0].name} забирает банк без вскрытия.`);
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
  const splitBase = winners.length === 0 ? 0 : Math.floor(hand.pot / winners.length);
  let remainder = winners.length === 0 ? 0 : hand.pot % winners.length;

  for (const winner of winners) {
    const chips = splitBase + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }
    winner.stack += chips;
    awarded[winner.id] = chips;
  }

  return {
    winnerIds: winners.map((winner) => winner.id),
    closestDistance,
    correctAnswer,
    reason,
    awarded,
  };
}

function moveChips(state: GameState, player: Player, hand: HandState, amount: number) {
  if (amount < 0) {
    throw new GameError("Некорректный размер ставки.");
  }

  if (amount === 0) {
    return;
  }

  if (player.stack < amount) {
    throw new GameError("Недостаточно фишек. В этой версии all-in и side-pot не поддерживаются.");
  }

  player.stack -= amount;
  hand.pot += amount;
  hand.roundContributions[player.id] = (hand.roundContributions[player.id] ?? 0) + amount;
  hand.totalContributions[player.id] = (hand.totalContributions[player.id] ?? 0) + amount;
}

function isBettingRoundComplete(state: GameState) {
  const hand = requireCurrentHand(state);
  const bettingPlayers = getBettingPlayers(state);

  return bettingPlayers.every((player) => {
    const contribution = hand.roundContributions[player.id] ?? 0;
    return hand.actedPlayerIds.includes(player.id) && contribution === hand.currentBet;
  });
}

function markActed(hand: HandState, playerId: string) {
  if (!hand.actedPlayerIds.includes(playerId)) {
    hand.actedPlayerIds.push(playerId);
  }
}

function allAlivePlayersAnswered(state: GameState) {
  const hand = requireCurrentHand(state);
  const alivePlayers = getAlivePlayers(state);

  return alivePlayers.every((player) => hand.submittedAnswers[player.id] !== undefined);
}

function getAlivePlayers(state: GameState) {
  return state.players.filter((player) => !player.isEliminated);
}

function getBettingPlayers(state: GameState) {
  const hand = requireCurrentHand(state);

  return getAlivePlayers(state).filter(
    (player) =>
      hand.submittedAnswers[player.id] !== undefined && !hand.foldedPlayerIds.includes(player.id),
  );
}

function requireCurrentHand(state: GameState) {
  if (!state.currentHand) {
    throw new GameError("Сейчас нет активного вопроса.");
  }

  return state.currentHand;
}

function requirePlayer(state: GameState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);

  if (!player) {
    throw new GameError("Игрок не найден.");
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
