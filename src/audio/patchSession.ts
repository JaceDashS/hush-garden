/**
 * The one nature sound patch of this app run. It starts when a garden is entered, keeps going when the garden is
 * left, and hands the finished files to the audio engine. Screens follow its progress with usePatchState().
 */
import { useEffect, useState } from "react";
import { SOUNDS_URL } from "../config";
import type { GardenAudio } from "./engine";
import { runPatch, type PatchState } from "./patch";
import { createSoundStore } from "./soundStore";

let state: PatchState | null = null;
let running = false;
const listeners = new Set<(state: PatchState | null) => void>();

function publish(next: PatchState | null) {
  state = next;
  for (const listener of listeners) listener(state);
}

/**
 * Starts the patch unless one is running or it already finished. `ask` is called with the size still missing
 * before anything is downloaded. `force` runs it again after a decline or a failure (the settings button, the
 * developer options).
 */
export function startPatch(audio: GardenAudio, ask: (missingBytes: number) => Promise<boolean>, force = false): void {
  if (running) return;
  if (!force && state && state.phase !== "failed") return;
  running = true;
  void runPatch(SOUNDS_URL, createSoundStore(), publish, ask)
    .then((files) => audio.setSoundFiles(files))
    .catch(() => publish({ phase: "failed", doneBytes: 0, totalBytes: 0, doneFiles: 0, totalFiles: 0 }))
    .finally(() => {
      running = false;
    });
}

/** Developer option: forgets every stored file, so the next start downloads everything again. */
export async function clearPatch(audio: GardenAudio): Promise<void> {
  if (running) return;
  audio.setSoundFiles(null);
  await createSoundStore().clear();
  publish(null);
}

/** The patch progress, or null before it started. */
export function usePatchState(): PatchState | null {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
