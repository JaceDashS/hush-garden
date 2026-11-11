/** The characters a player can choose. The id is stored on the device and sent to the server when entering. */

export const CHARACTER_KINDS = ["bunny", "cat", "bear", "frog", "chick", "fox", "penguin", "pig", "panda", "mouse"] as const;

export type CharacterKind = (typeof CHARACTER_KINDS)[number];

export const DEFAULT_CHARACTER: CharacterKind = "bunny";

/** Names shown in the character picker. */
export const CHARACTER_NAMES: Record<CharacterKind, string> = {
  bunny: "토끼",
  cat: "고양이",
  bear: "곰",
  frog: "개구리",
  chick: "병아리",
  fox: "여우",
  penguin: "펭귄",
  pig: "돼지",
  panda: "판다",
  mouse: "생쥐",
};

/** Any stored or received value becomes a known character; unknown values become the default. */
export function normalizeCharacter(value: unknown): CharacterKind {
  return CHARACTER_KINDS.includes(value as CharacterKind) ? (value as CharacterKind) : DEFAULT_CHARACTER;
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
}

export const STANDING: Pose = { bob: 0, leftFoot: { x: 0, y: 0 }, rightFoot: { x: 0, y: 0 }, arm: 0, sway: 0 };

const WALK_POSES: readonly Pose[] = [
  { bob: -2, leftFoot: { x: 3, y: -4 }, rightFoot: { x: -2, y: 0 }, arm: 24, sway: 5 },
  { bob: 0, leftFoot: { x: 1, y: 0 }, rightFoot: { x: -1, y: 0 }, arm: 0, sway: 0 },
  { bob: -2, leftFoot: { x: -2, y: 0 }, rightFoot: { x: 3, y: -4 }, arm: -24, sway: -5 },
  { bob: 0, leftFoot: { x: -1, y: 0 }, rightFoot: { x: 1, y: 0 }, arm: 0, sway: 0 },
];

/** Pose for a character: a walking picture while it moves, the standing pose otherwise. */
export function poseFor(walking: boolean, frame: number): Pose {
  return walking ? WALK_POSES[((frame % WALK_FRAMES) + WALK_FRAMES) % WALK_FRAMES] : STANDING;
}
