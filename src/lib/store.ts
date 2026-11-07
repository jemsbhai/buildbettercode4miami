import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createSeed } from "./seed";
import type { DemoState } from "./types";

const filename = () => process.env.TIDEPATH_STATE_FILE || join(process.cwd(), ".data", "state.json");

// Synchronous read-modify-rename is serialized within ONE Node process. Not a multi-host database.
export function readState(): DemoState {
  const path = filename();
  if (!existsSync(path)) saveState(createSeed());
  return JSON.parse(readFileSync(path, "utf8")) as DemoState;
}

function saveState(state: DemoState) {
  const path = filename();
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(state, null, 2), "utf8");
  renameSync(temp, path);
}

export function mutateState<T>(operation: (state: DemoState) => T): T {
  const state = readState();
  const result = operation(state);
  if (result instanceof Promise) throw new Error("State transactions must be synchronous.");
  saveState(state);
  return result;
}

export function resetState() {
  const state = createSeed();
  saveState(state);
  return state;
}
