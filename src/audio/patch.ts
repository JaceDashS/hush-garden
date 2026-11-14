/**
 * The nature sound patch: after entering, every built recording is downloaded from the platform server onto the
 * device. Nature sources can be chosen and heard only once all files are there. The server's manifest lists the
 * files with their sizes and a version; files already on the device are kept, missing ones are fetched, and files
 * of older versions are removed. Without a connection, a complete earlier download is used as it is.
 */
import { isManifest, type SoundFiles, type SoundManifest } from "./library";

/** Where the downloaded files live: the web's Cache API or the phone's document folder (soundStore.ts). */
export interface SoundStore {
  has(path: string, bytes: number): Promise<boolean>;
  download(url: string, path: string): Promise<void>;
  source(path: string): Promise<ArrayBuffer | string>;
  /** Removes stored files whose path is not in `keep`. */
  prune(keep: Set<string>): Promise<void>;
  readManifest(): Promise<unknown>;
  writeManifest(manifest: SoundManifest): Promise<void>;
}

export type PatchPhase = "checking" | "downloading" | "ready" | "failed";

export interface PatchState {
  phase: PatchPhase;
  doneBytes: number;
  totalBytes: number;
  doneFiles: number;
  totalFiles: number;
}

/** Files downloaded at the same time. */
export const PATCH_PARALLEL = 3;

const files = (manifest: SoundManifest) => manifest.recordings.flatMap((recording) => recording.files);

/**
 * Brings the device up to the server's manifest. Reports progress through `onState` and resolves with the files
 * to play, or null when they cannot all be there (then nature sources stay unavailable this session).
 */
export async function runPatch(baseUrl: string, store: SoundStore, onState: (state: PatchState) => void, fetchJson: (url: string) => Promise<unknown> = (url) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status))))): Promise<SoundFiles | null> {
  const base = baseUrl.replace(/\/+$/, "") + "/";
  onState({ phase: "checking", doneBytes: 0, totalBytes: 0, doneFiles: 0, totalFiles: 0 });
  let manifest: SoundManifest | null = null;
  try {
    const remote = await fetchJson(base + "manifest.json");
    if (isManifest(remote)) manifest = remote;
  } catch {
    // offline or the server is down: fall back to what is stored
  }
  const stored = await store.readManifest().catch(() => null);
  if (!manifest && isManifest(stored)) manifest = stored;
  if (!manifest) {
    onState({ phase: "failed", doneBytes: 0, totalBytes: 0, doneFiles: 0, totalFiles: 0 });
    return null;
  }
  const all = files(manifest);
  const state: PatchState = { phase: "downloading", doneBytes: 0, totalBytes: manifest.totalBytes, doneFiles: 0, totalFiles: all.length };
  const missing = [];
  for (const file of all) {
    if (await store.has(file.path, file.bytes)) {
      state.doneBytes += file.bytes;
      state.doneFiles += 1;
    } else missing.push(file);
  }
  onState({ ...state });
  let failed = false;
  const queue = [...missing];
  const worker = async () => {
    for (let file = queue.shift(); file && !failed; file = queue.shift()) {
      try {
        await store.download(base + file.path, file.path);
        state.doneBytes += file.bytes;
        state.doneFiles += 1;
        onState({ ...state });
      } catch {
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PATCH_PARALLEL, missing.length) }, worker));
  if (failed || state.doneFiles < state.totalFiles) {
    onState({ ...state, phase: "failed" });
    return null;
  }
  await store.writeManifest(manifest);
  await store.prune(new Set(all.map((file) => file.path))).catch(() => undefined);
  onState({ ...state, phase: "ready" });
  return { manifest, source: (path) => store.source(path) };
}
