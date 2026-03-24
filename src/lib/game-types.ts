export type GamePhase = "lobby" | "question" | "decision" | "showdown" | "finished";

export interface StageMedia {
  text: string;
  imageUrl: string | null;
}

export interface Question {
  id: string;
  text: string;
  answer: number;
  imageUrl: string | null;
  hints: [StageMedia, StageMedia];
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
  contributions: Record<string, number>;
  currentDecisionStage: number | null;
  decisionResponses: Record<string, "continue" | "fold">;
  result: ShowdownResult | null;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  joinCode: string;
  startingStack: number;
  continueCost: number;
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
