import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createInitialState } from "@/lib/game-engine";
import { GameState } from "@/lib/game-types";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const stateFilePath = path.join(dataDir, "game-state.json");

let queue = Promise.resolve<unknown>(undefined);

async function ensureStateFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(stateFilePath, "utf8");
  } catch {
    await writeFile(stateFilePath, JSON.stringify(createInitialState(), null, 2), "utf8");
  }
}

export async function readState() {
  await ensureStateFile();
  const raw = await readFile(stateFilePath, "utf8");
  return JSON.parse(raw) as GameState;
}

export async function withState<T>(updater: (state: GameState) => Promise<T> | T) {
  const task = queue.then(async () => {
    const state = await readState();
    const result = await updater(state);
    await writeFile(stateFilePath, JSON.stringify(state, null, 2), "utf8");
    return result;
  });

  queue = task.then(
    () => undefined,
    () => undefined,
  );

  return task;
}
