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
let started = false;
const listeners = new Set<(state: PatchState | null) => void>();

function publish(next: PatchState) {
  state = next;
  for (const listener of listeners) listener(state);
}

/** Starts the patch once per app run; later calls do nothing. A failed patch is tried again on the next call. */
export function startPatch(audio: GardenAudio): void {
  if (started && state?.phase !== "failed") return;
  started = true;
  void runPatch(SOUNDS_URL, createSoundStore(), publish)
    .then((files) => audio.setSoundFiles(files))
    .catch(() => publish({ phase: "failed", doneBytes: 0, totalBytes: 0, doneFiles: 0, totalFiles: 0 }));
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
