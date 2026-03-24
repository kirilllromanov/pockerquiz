import { NextResponse } from "next/server";

import { ApiResponse, GameState } from "@/lib/game-types";
import {
  GameError,
  applyPlayerBetAction,
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
        case "bet-action":
          applyPlayerBetAction(draft, {
            playerId: String(body.payload?.playerId ?? ""),
            action: String(body.payload?.move ?? "") as "check" | "call" | "raise" | "fold",
            amount:
              body.payload?.amount === undefined ? undefined : Number(body.payload?.amount),
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
        error: error instanceof GameError ? error.message : "Не удалось выполнить действие игрока.",
      } satisfies ApiResponse<never>,
      { status: 400 },
    );
  }
}
