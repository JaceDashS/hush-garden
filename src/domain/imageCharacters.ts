/**
 * Characters drawn from an uploaded image map (a sprite sheet) instead of in code. The platform server checks the
 * format, keeps the review state and serves approved images; this file holds the format and picks frames.
 */
import type { ActionName } from "./actions";
import { CHARACTER_KINDS, WALK_FRAMES, type CharacterKind } from "./characters";

/** One PNG of 8 × 6 frames of 128 px. The character faces right and its feet touch `foot` in every frame. */
export const SHEET = { width: 1024, height: 768, frame: 128, columns: 8, foot: { x: 64, y: 120 } } as const;

/** The rows of the image map from the top and how many frames each uses from the left. */
export const SHEET_ROWS = {
  stand: { row: 0, frames: 1 },
  walk: { row: 1, frames: WALK_FRAMES },
  lift: { row: 2, frames: 6 },
  carry: { row: 3, frames: WALK_FRAMES },
  create: { row: 4, frames: 8 },
  discard: { row: 5, frames: 8 },
} as const;

/** How many pending or approved characters an account may hold; the server enforces it. */
export const CHARACTER_LIMIT = 5;
export const CHARACTER_NAME_MAX = 24;

/** A character id from the server: 32 lower-case hex characters. Anything else is ignored. */
export function isCharacterId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

/** Where the approved image of a character is served. A character never changes, so the URL never goes stale. */
export function sheetUrl(apiOrigin: string, id: string): string {
  return apiOrigin + "/hush-garden/characters/" + id + ".png";
}

/**
 * The drawn character shown while an image character's image is loading: always the same one for an id, so
 * every visitor sees the same stand-in.
 * Example: fallbackKind("3f2c…") → "fox" on every device.
 */
export function fallbackKind(id: string): CharacterKind {
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return CHARACTER_KINDS[hash % CHARACTER_KINDS.length];
}

export interface FrameState {
  walking: boolean;
  carrying: boolean;
  /** The walking frame, 0 to 3. */
  frame: number;
  /** The action being played and how far it is, 0 to 1. */
  action?: { name: ActionName; progress: number };
}

/**
 * The frame of the image map to show. An action plays its row from the first frame to the last (putting down
 * plays the lifting row backwards); otherwise holding a speaker uses the carrying row, walking the walking row
 * and standing still the single standing frame.
 * Example: { walking: true, carrying: false, frame: 2 } → { row: 1, column: 2 }.
 */
export function sheetFrame(state: FrameState): { row: number; column: number } {
  const pick = (row: { row: number; frames: number }, progress: number) => ({ row: row.row, column: Math.min(row.frames - 1, Math.max(0, Math.floor(progress * row.frames))) });
  const step = ((state.frame % WALK_FRAMES) + WALK_FRAMES) % WALK_FRAMES;
  if (state.action) {
    const { name, progress } = state.action;
    if (name === "lift") return pick(SHEET_ROWS.lift, progress);
    if (name === "putDown") return pick(SHEET_ROWS.lift, 1 - progress);
    return pick(name === "create" ? SHEET_ROWS.create : SHEET_ROWS.discard, progress);
  }
  if (state.carrying) return { row: SHEET_ROWS.carry.row, column: state.walking ? step : 0 };
  if (state.walking) return { row: SHEET_ROWS.walk.row, column: step };
  return { row: SHEET_ROWS.stand.row, column: 0 };
}

/** One of the account's characters as the server lists it. */
export interface OwnCharacter {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy: { id: string; username: string } | null;
  reviewedAt: string | null;
  rejectReason: string | null;
}

/** The account's characters, whether it may upload, and the limit, from `GET /hush-garden/characters/mine`. */
export interface CharacterList {
  characters: OwnCharacter[];
  canUpload: boolean;
  limit: number;
}

/** Keeps only well-formed characters from a server answer. */
export function normalizeCharacterList(value: unknown): CharacterList {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const list = Array.isArray(v.characters) ? v.characters : [];
  const characters: OwnCharacter[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    if (!isCharacterId(c.id) || typeof c.name !== "string" || (c.status !== "pending" && c.status !== "approved" && c.status !== "rejected")) continue;
    const reviewer = c.reviewedBy && typeof c.reviewedBy === "object" ? (c.reviewedBy as Record<string, unknown>) : null;
    characters.push({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: typeof c.createdAt === "string" ? c.createdAt : "",
      reviewedBy: reviewer && typeof reviewer.id === "string" ? { id: reviewer.id, username: typeof reviewer.username === "string" ? reviewer.username : "" } : null,
      reviewedAt: typeof c.reviewedAt === "string" ? c.reviewedAt : null,
      rejectReason: typeof c.rejectReason === "string" ? c.rejectReason : null,
    });
  }
  return { characters, canUpload: v.canUpload === true, limit: typeof v.limit === "number" ? v.limit : CHARACTER_LIMIT };
}

/**
 * Width and height from a PNG's header in base64, or null when it is not a PNG. Lets the app refuse a wrong
 * size before uploading; the server checks again.
 */
export function readPngSize(base64: string): { width: number; height: number } | null {
  const head = base64.slice(0, 44);
  let bytes: number[];
  try {
    const text = atob(head.slice(0, head.length - (head.length % 4)));
    bytes = Array.from(text, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((byte, index) => bytes[index] !== byte)) return null;
  const word = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  return { width: word(16), height: word(20) };
}
