/**
 * The built nature sound files once they are on the device: what exists (the manifest the platform server hands
 * out with them, see scripts/build-sounds.ts) and decoded audio on demand. Decoded chunks are large (a minute of
 * 44.1 kHz stereo is about 21 MB), so only the most recently used few are kept.
 */
import type { AudioBuffer, AudioContext } from "react-native-audio-api";

export interface ManifestFile {
  path: string;
  bytes: number;
}

export interface ManifestRecording {
  id: string;
  source: string;
  /** Long recordings come as one-minute chunks; the heartbeat as single beats. */
  kind: "chunks" | "beats";
  chunkSeconds?: number;
  files: ManifestFile[];
}

export interface SoundManifest {
  version: string;
  totalBytes: number;
  recordings: ManifestRecording[];
}

/**
 * Where the files are read from. `source` returns what decodeAudioData takes: the bytes, or on the phone a local
 * file path, which decodes without passing the file through JavaScript.
 */
export interface SoundFiles {
  manifest: SoundManifest;
  source(path: string): Promise<ArrayBuffer | string>;
}

/** Decoded chunks kept at once, across all recordings. */
export const MAX_DECODED_CHUNKS = 4;

export function isManifest(value: unknown): value is SoundManifest {
  const v = value as SoundManifest;
  return !!v && typeof v.version === "string" && typeof v.totalBytes === "number" && Array.isArray(v.recordings) && v.recordings.every((r) => typeof r.id === "string" && Array.isArray(r.files));
}

export class SoundLibrary {
  private chunks = new Map<string, Promise<AudioBuffer>>();
  private beats = new Map<string, Promise<AudioBuffer[]>>();

  constructor(private files: SoundFiles, private maxChunks = MAX_DECODED_CHUNKS) {}

  private entry(id: string): ManifestRecording | undefined {
    return this.files.manifest.recordings.find((recording) => recording.id === id);
  }

  /** Whether a recording can be played: it is in the manifest. */
  has(id: string): boolean {
    return !!this.entry(id);
  }

  chunkCount(id: string): number {
    const entry = this.entry(id);
    return entry?.kind === "chunks" ? entry.files.length : 0;
  }

  /** One decoded chunk of a long recording. Least recently used chunks are forgotten beyond the limit. */
  chunk(context: AudioContext, id: string, index: number): Promise<AudioBuffer> {
    const entry = this.entry(id);
    const file = entry?.files[index];
    if (!entry || !file) return Promise.reject(new Error("no chunk " + index + " of " + id));
    const cached = this.chunks.get(file.path);
    if (cached) {
      // Move to the end: most recently used.
      this.chunks.delete(file.path);
      this.chunks.set(file.path, cached);
      return cached;
    }
    const decoded = this.files.source(file.path).then((input) => context.decodeAudioData(input as ArrayBuffer));
    decoded.catch(() => this.chunks.delete(file.path));
    this.chunks.set(file.path, decoded);
    while (this.chunks.size > this.maxChunks) this.chunks.delete(this.chunks.keys().next().value as string);
    return decoded;
  }

  /** All single beats of a beat recording, decoded once and kept (they are small). */
  beatBuffers(context: AudioContext, id: string): Promise<AudioBuffer[]> {
    const entry = this.entry(id);
    if (!entry || entry.kind !== "beats") return Promise.reject(new Error("no beats for " + id));
    let decoded = this.beats.get(id);
    if (!decoded) {
      decoded = Promise.all(entry.files.map((file) => this.files.source(file.path).then((input) => context.decodeAudioData(input as ArrayBuffer))));
      decoded.catch(() => this.beats.delete(id));
      this.beats.set(id, decoded);
    }
    return decoded;
  }
}
