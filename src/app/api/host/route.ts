import { NextResponse } from "next/server";

import {
  GameError,
  addQuestion,
  clearPlayers,
  deleteQuestion,
  endGame,
  resetGame,
  revealHint,
  revealShowdown,
  sanitizeState,
  startGame,
  startNextQuestion,
} from "@/lib/game-engine";
import { withState } from "@/lib/game-store";
import { saveUploadedImage } from "@/lib/upload-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = String(formData.get("action") ?? "");

      if (action !== "add-question") {
        throw new GameError("Unsupported multipart host action.");
      }

      const state = await withState(async (draft) => {
        addQuestion(draft, {
          text: String(formData.get("text") ?? ""),
          answer: Number(formData.get("answer")),
          imageUrl: await saveUploadedImage(toFile(formData.get("questionImage"))),
          hint1: String(formData.get("hint1") ?? ""),
          hint1ImageUrl: await saveUploadedImage(toFile(formData.get("hint1Image"))),
          hint2: String(formData.get("hint2") ?? ""),
          hint2ImageUrl: await saveUploadedImage(toFile(formData.get("hint2Image"))),
        });

        return sanitizeState(draft, "host");
      }, { persistQuestions: true });

      return NextResponse.json({
        ok: true,
        data: state,
      });
    }

    const body = (await request.json()) as {
      action: string;
      payload?: Record<string, unknown>;
    };

    const state = await withState((draft) => {
      switch (body.action) {
        case "start-game":
          startGame(draft);
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
        case "end-game":
          endGame(draft);
          break;
        case "delete-question":
          deleteQuestion(draft, String(body.payload?.questionId ?? ""));
          break;
        case "clear-players":
          clearPlayers(draft);
          break;
        case "reset-game":
          resetGame(draft);
          break;
        default:
          throw new GameError("Unknown host action.");
      }

      return sanitizeState(draft, "host");
    }, { persistQuestions: body.action === "delete-question" });

    return NextResponse.json({
      ok: true,
      data: state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof GameError ? error.message : "Host action failed.",
      },
      { status: 400 },
    );
  }
}

function toFile(entry: FormDataEntryValue | null) {
  return entry instanceof File ? entry : null;
}
