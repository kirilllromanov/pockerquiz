import { NextResponse } from "next/server";

import { ApiResponse, GameState } from "@/lib/game-types";
import {
  GameError,
  applyPlayerDecision,
  joinPlayer,
  sanitizeState,
  submitAnswer,
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

    const result = await withState((draft) => {
      switch (body.action) {
        case "join": {
          const player = joinPlayer(draft, {
            name: String(body.payload?.name ?? ""),
          });
          return {
            playerId: player.id,
            state: sanitizeState(draft, "player"),
          };
        }
        case "submit-answer":
          submitAnswer(draft, {
            playerId: String(body.payload?.playerId ?? ""),
            answer: Number(body.payload?.answer),
          });
          return {
            state: sanitizeState(draft, "player"),
          };
        case "decision":
          applyPlayerDecision(draft, {
            playerId: String(body.payload?.playerId ?? ""),
            choice: String(body.payload?.choice ?? "") as "continue" | "fold",
          });
          return {
            state: sanitizeState(draft, "player"),
          };
        default:
          throw new GameError("Неизвестное действие игрока.");
      }
    });

    return NextResponse.json({
      ok: true,
      data: result,
    } satisfies ApiResponse<{ playerId?: string; state: GameState }>);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof GameError ? error.message : "Player action failed.",
      } satisfies ApiResponse<never>,
      { status: 400 },
    );
  }
}
