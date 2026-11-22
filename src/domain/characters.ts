/** The characters a player can choose. The id is stored on the device and sent to the server when entering. */

export const CHARACTER_KINDS = ["bunny", "cat", "bear", "frog", "chick", "fox", "penguin", "pig", "panda", "mouse"] as const;

export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export const DEFAULT_CHARACTER: CharacterKind = "bunny";

/** Body colour of each drawn character; also used as the default chat ripple colour. */
export const CHARACTER_COLORS: Record<CharacterKind, string> = {
  bunny: "#ffd1dc",
  cat: "#ffd9a0",
  bear: "#d9b08c",
  frog: "#b4e39a",
  chick: "#fff0a0",
  fox: "#ffb27a",
  penguin: "#8fa8c8",
  pig: "#ffc2cf",
  panda: "#ffffff",
  mouse: "#d8d8e6",
};

/** Selectable chat ripple colours in Settings (in addition to "" for character default). */
export const CHAT_RIPPLE_COLORS: readonly string[] = [
  "#ffd1dc",
  "#ffd9a0",
  "#d9b08c",
  "#b4e39a",
  "#fff0a0",
  "#ffb27a",
  "#8fa8c8",
  "#ffc2cf",
  "#ffffff",
  "#d8d8e6",
  "#8fd6b4",
  "#ff9eb5",
];

export function resolveChatColor(character: CharacterKind, chatColor?: string): string {
  return chatColor && /^#[0-9a-fA-F]{6}$/.test(chatColor) ? chatColor : CHARACTER_COLORS[character];
}

export function isCharacterKind(value: unknown): value is CharacterKind {
  return typeof value === "string" && CHARACTER_KINDS.includes(value as CharacterKind);
}

/** Any stored or received value becomes a known character; unknown values become the default. */
export function normalizeCharacter(value: unknown): CharacterKind {
  return isCharacterKind(value) ? value : DEFAULT_CHARACTER;
}

/** Uniformly picks one of the standard characters, clamping out-of-range random values safely into [0, 1). */
export function randomCharacter(random: () => number = Math.random): CharacterKind {
  const raw = random();
  const index = Number.isFinite(raw)
    ? Math.max(0, Math.min(CHARACTER_KINDS.length - 1, Math.floor(raw * CHARACTER_KINDS.length)))
    : 0;
  return CHARACTER_KINDS[index];
}

/** Number of pictures in one walking cycle. */
export const WALK_FRAMES = 4;
/** Time each walking picture is shown, in milliseconds. */
export const WALK_FRAME_MS = 130;

/** The picture after `frame` in the walking cycle. */
export function nextWalkFrame(frame: number): number {
  return (frame + 1) % WALK_FRAMES;
}

/**
 * How the body parts sit in one walking picture. Frames 0 and 2 are steps (left foot, then right foot, lifted
 * with the body raised); frames 1 and 3 are the passing poses in between. Standing still uses `STANDING`.
 */
export interface Pose {
  /** Vertical offset of the body and head; negative is up. */
  bob: number;
  leftFoot: { x: number; y: number };
  rightFoot: { x: number; y: number };
  /** Arm swing in degrees; the two arms swing opposite ways. */
  arm: number;
  /** Ear or head-top sway in degrees. */
  sway: number;
  /** Both arms are raised to hold something overhead. */
  armsUp?: boolean;
  /** Both arms lifted outward by this many degrees; negative closes them in front. */
  open?: number;
}

export const STANDING: Pose = { bob: 0, leftFoot: { x: 0, y: 0 }, rightFoot: { x: 0, y: 0 }, arm: 0, sway: 0 };

const WALK_POSES: readonly Pose[] = [
  { bob: -2, leftFoot: { x: 3, y: -4 }, rightFoot: { x: -2, y: 0 }, arm: 24, sway: 5 },
  { bob: 0, leftFoot: { x: 1, y: 0 }, rightFoot: { x: -1, y: 0 }, arm: 0, sway: 0 },
  { bob: -2, leftFoot: { x: -2, y: 0 }, rightFoot: { x: 3, y: -4 }, arm: -24, sway: -5 },
  { bob: 0, leftFoot: { x: -1, y: 0 }, rightFoot: { x: 1, y: 0 }, arm: 0, sway: 0 },
];

/**
 * Pose for a character: a walking picture while it moves, the standing pose otherwise. While carrying, the arms
 * stay raised and the feet keep stepping.
 */
export function poseFor(walking: boolean, frame: number, carrying = false): Pose {
  const pose = walking ? WALK_POSES[((frame % WALK_FRAMES) + WALK_FRAMES) % WALK_FRAMES] : STANDING;
  return carrying ? { ...pose, arm: 0, armsUp: true } : pose;
}

/** A character can lift a speaker from this many tiles away; the lift button shows within this distance. */
export const PICK_UP_TILES = 1.6;

/** The character before or after `kind` in the picker, wrapping around at the ends. */
export function stepCharacter(kind: CharacterKind, direction: 1 | -1): CharacterKind {
  const index = Math.max(0, CHARACTER_KINDS.indexOf(kind));
  return CHARACTER_KINDS[(index + direction + CHARACTER_KINDS.length) % CHARACTER_KINDS.length];
}

/** Room left beside the chosen character when the picker scrolls to it. */
const PICKER_MARGIN = 12;
/** Where a scrolling row must move to show an item fully, or null when it is already in view. */
export function scrollToShow(item: { x: number; width: number }, view: { offset: number; width: number }): number | null {
  if (view.width <= 0) return null;
  if (item.x - PICKER_MARGIN < view.offset) return Math.max(0, item.x - PICKER_MARGIN);
  if (item.x + item.width + PICKER_MARGIN > view.offset + view.width) return item.x + item.width + PICKER_MARGIN - view.width;
  return null;
}
