import { NextResponse } from "next/server";

import {
  GameError,
  addQuestion,
  resetGame,
  revealHint,
  revealShowdown,
  sanitizeState,
  startBettingRound,
  startGame,
  startNextQuestion,
} from "@/lib/game-engine";
import { withState } from "@/lib/game-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action: string;
      payload?: Record<string, unknown>;
    };

    const state = await withState((draft) => {
      switch (body.action) {
        case "add-question":
          addQuestion(draft, {
            text: String(body.payload?.text ?? ""),
            answer: Number(body.payload?.answer),
            hint1: String(body.payload?.hint1 ?? ""),
            hint2: String(body.payload?.hint2 ?? ""),
          });
          break;
        case "start-game":
          startGame(draft);
          break;
        case "start-betting":
          startBettingRound(draft);
          break;
        case "reveal-hint":
          revealHint(draft);
          break;
        case "showdown":
          revealShowdown(draft);
          break;
        case "next-question":
          startNextQuestion(draft);
          break;
        case "reset-game":
          resetGame(draft);
          break;
        default:
          throw new GameError("Неизвестное действие ведущего.");
      }

      return sanitizeState(draft, "host");
    });

    return NextResponse.json({
      ok: true,
      data: state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof GameError ? error.message : "Не удалось выполнить действие ведущего.",
      },
      { status: 400 },
    );
  }
}
