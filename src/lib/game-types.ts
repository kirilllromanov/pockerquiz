export type GamePhase =
  | "lobby"
  | "question"
  | "hint"
  | "betting"
  | "showdown"
  | "finished";

export interface Question {
  id: string;
  text: string;
  answer: number;
  hints: [string, string];
}

export interface Player {
  id: string;
  name: string;
  stack: number;
  isEliminated: boolean;
  joinedAt: string;
}

export interface ShowdownResult {
  winnerIds: string[];
  closestDistance: number;
  correctAnswer: number;
  reason: "closest-answer" | "last-player-standing";
  awarded: Record<string, number>;
}

export interface HandState {
  questionId: string;
  questionIndex: number;
  revealedHints: number;
  submittedAnswers: Record<string, number>;
  foldedPlayerIds: string[];
  pot: number;
  currentBet: number;
  roundContributions: Record<string, number>;
  totalContributions: Record<string, number>;
  actedPlayerIds: string[];
  bettingRound: number;
  result: ShowdownResult | null;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  joinCode: string;
  startingStack: number;
  minRaise: number;
  questions: Question[];
  players: Player[];
  currentQuestionIndex: number;
  currentHand: HandState | null;
  message: string;
  updatedAt: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
