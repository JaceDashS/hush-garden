/** Nearby chat: who receives a message and how strongly the listener's sound reacts to it. */
import { TILE_WIDTH, distance, toScreen, type Point } from "./world";

/** Messages reach characters within this many tiles. */
export const CHAT_RANGE = 10;
export const CHAT_MAX_LENGTH = 200;
/** A speech bubble stays this long. */
export const BUBBLE_MS = 6000;

export type CueMode = "tone" | "dip" | "off";

/** Trims a message and drops control characters; returns null when nothing is left. */
export function cleanMessage(text: unknown): string | null {
  if (typeof text !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT_MAX_LENGTH);
  return cleaned || null;
}

export function inChatRange(a: Point, b: Point): boolean {
  return distance(a, b) <= CHAT_RANGE;
}

export interface Cue {
  /** 0 to 1: how far the tone closes (or the volume dips). Closer speakers give a deeper cue. */
  depth: number;
  /** -1 to 1: the side the speaker is on. */
  pan: number;
}

/**
 * The audible hint that someone nearby spoke. The noise keeps its volume and bass; only its brightness
 * shifts for a moment, so the masking does not open up. Returns null when the speaker is out of range.
 */
export function cueFor(listener: Point, talker: Point): Cue | null {
  const tiles = distance(listener, talker);
  if (tiles > CHAT_RANGE) return null;
  const closeness = 1 - tiles / CHAT_RANGE;
  const dx = toScreen(talker).x - toScreen(listener).x;
  const pan = Math.max(-1, Math.min(1, dx / (CHAT_RANGE * (TILE_WIDTH / 2))));
  return { depth: 0.25 + 0.6 * closeness, pan };
}

/** Timing of a cue in seconds: fade in, hold, fade out. */
export const CUE_TIMING = { fade: 0.05, hold: 0.22 } as const;
