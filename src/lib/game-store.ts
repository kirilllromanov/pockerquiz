import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createInitialState } from "@/lib/game-engine";
import { GameState, Question } from "@/lib/game-types";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const runtimeFilePath = path.join(dataDir, "runtime-state.json");
const questionsFilePath = path.join(dataDir, "questions.json");

let queue = Promise.resolve<unknown>(undefined);

type RuntimeState = Omit<GameState, "questions">;

function toRuntimeState(state: GameState): RuntimeState {
  const { questions, ...runtime } = state;
  void questions;
  return runtime;
}

async function ensureStorageFiles() {
  await mkdir(dataDir, { recursive: true });
  const initialState = createInitialState();

  try {
    await readFile(runtimeFilePath, "utf8");
  } catch {
    await writeFile(runtimeFilePath, JSON.stringify(toRuntimeState(initialState), null, 2), "utf8");
  }

  try {
    await readFile(questionsFilePath, "utf8");
  } catch {
    try {
      const legacyRaw = await readFile(path.join(dataDir, "game-state.json"), "utf8");
      const legacyState = JSON.parse(legacyRaw) as GameState;
      await writeFile(questionsFilePath, JSON.stringify(legacyState.questions ?? [], null, 2), "utf8");
    } catch {
      await writeFile(questionsFilePath, JSON.stringify(initialState.questions, null, 2), "utf8");
    }
  }
}

export async function readState() {
  await ensureStorageFiles();
  const [runtimeRaw, questionsRaw] = await Promise.all([
    readFile(runtimeFilePath, "utf8"),
    readFile(questionsFilePath, "utf8"),
  ]);

  const runtime = JSON.parse(runtimeRaw) as RuntimeState;
  const questions = JSON.parse(questionsRaw) as Question[];

  return {
    ...runtime,
    questions,
  } satisfies GameState;
}

export async function withState<T>(
  updater: (state: GameState) => Promise<T> | T,
  options?: { persistQuestions?: boolean },
) {
  const task = queue.then(async () => {
    const state = await readState();
    const result = await updater(state);

    await writeFile(runtimeFilePath, JSON.stringify(toRuntimeState(state), null, 2), "utf8");

    if (options?.persistQuestions) {
      await writeFile(questionsFilePath, JSON.stringify(state.questions, null, 2), "utf8");
    }

    return result;
  });

  queue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}
