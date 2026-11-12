/**
 * What a character does with a speaker: making one, discarding one, lifting one and putting it down (lifting
 * played backwards). Making and discarding are
 * different for each of the ten characters; lifting is shared. Each action is a list of keyframes that the
 * scene plays back, so the motions are data and can be checked without drawing anything.
 *
 * Distances are in screen pixels measured from the character's feet: x is the way the character faces and y is up.
 */
import type { CharacterKind } from "./characters";

/** `putDown` plays `lift` backwards. */
export type ActionName = "create" | "discard" | "lift" | "putDown";
/** What the thing in the character's hands looks like at the moment. */
export type PropForm = "speaker" | "egg" | "yarn" | "leaf";
export type FxKind = "puff" | "dirt" | "sparkle" | "crumbs" | "crack" | "leaves";

/** How the character's body is displaced on top of its normal pose. */
export interface Stance {
  /** Height above the ground. */
  hop: number;
  /** Sideways move in the facing direction. */
  shiftX: number;
  /** Lean in degrees around the feet; positive leans the way the character faces. */
  tilt: number;
  /** Vertical stretch of the body; 1 is normal, less is a crouch. */
  squash: number;
  /** Both arms swinging the same way, in degrees. */
  arm: number;
  /** Both arms raised outward, in degrees; negative closes them in front. */
  open: number;
  /** Ear sway in degrees. */
  sway: number;
}

export interface PropState {
  x: number;
  y: number;
  scale: number;
  /** Vertical stretch on top of `scale`. */
  squash: number;
  /** Rotation in degrees. */
  spin: number;
  opacity: number;
}

export interface Keyframe {
  /** Milliseconds from the start. Values glide from the previous keyframe to this one. */
  t: number;
  c?: Partial<Stance>;
  p?: Partial<PropState>;
  /** From this keyframe on: arms held overhead or hanging. */
  arms?: "up" | "down";
  form?: PropForm;
  /** -1 turns the character around. */
  turn?: 1 | -1;
  /** The prop moves with the character's hop and shift. */
  ride?: boolean;
  /** The feet step while the body moves. */
  walk?: boolean;
  /** Shape of the glide into this keyframe: "out" slows down at the end (rising), "in" speeds up (falling). */
  ease?: "in" | "out" | "inOut";
  /** One-shot effects that start at this keyframe: kind, x, y. */
  fx?: readonly (readonly [FxKind, number, number])[];
}

export interface ActionMoment {
  stance: Stance;
  prop: PropState;
  arms: "up" | "down";
  form: PropForm;
  turn: 1 | -1;
  walk: boolean;
  effects: { kind: FxKind; x: number; y: number; progress: number }[];
  done: boolean;
}

/** How long a one-shot effect is shown. */
export const FX_MS = 420;

export const NEUTRAL: Stance = { hop: 0, shiftX: 0, tilt: 0, squash: 1, arm: 0, open: 0, sway: 0 };
/** Where a held speaker sits: on the raised hands above the head. */
export const CARRY: PropState = { x: 0, y: 46, scale: 1, squash: 1, spin: 0, opacity: 1 };

const HIDDEN: Partial<PropState> = { opacity: 0 };
const HELD: Keyframe = { t: 0, p: CARRY, arms: "up", form: "speaker" };
const down = (x: number): Partial<PropState> => ({ x, y: 0, scale: 1, squash: 1, spin: 0, opacity: 1 });

/** Where a speaker on the ground sits for the character, in prop coordinates (x the facing way, y up). */
export interface GroundSpot {
  x: number;
  y: number;
}
/** Where a lift starts when the scene does not say where the speaker stands. */
export const DEFAULT_GROUND: GroundSpot = { x: 24, y: 0 };

/**
 * Shared by every character: the speaker rises from where it stands on the ground to overhead, at full size the
 * whole way. The character first crouches from its normal pose, so the start and the end both join the poses
 * before and after without a jump, and putting down can play the same frames backwards. Every step eases in and
 * out, so it is smooth both ways.
 */
function liftFrames(ground: GroundSpot): Keyframe[] {
  return [
    { t: 0, p: { ...down(ground.x), y: ground.y }, form: "speaker", arms: "down", c: NEUTRAL },
    { t: 120, arms: "up", c: { squash: 0.86, tilt: 10 }, ease: "inOut" },
    { t: 250, p: { x: ground.x * 0.6, y: Math.max(ground.y, 0) + 22 }, c: { squash: 0.94, tilt: 4 }, ease: "inOut" },
    { t: 480, p: CARRY, c: NEUTRAL, ease: "inOut" },
  ];
}
const LIFT = liftFrames(DEFAULT_GROUND);
const liftCache = new Map<string, readonly Keyframe[]>();
function liftFor(ground: GroundSpot | undefined): readonly Keyframe[] {
  if (!ground) return LIFT;
  const key = Math.round(ground.x) + "," + Math.round(ground.y);
  let frames = liftCache.get(key);
  if (!frames) {
    if (liftCache.size > 64) liftCache.clear();
    frames = liftFrames({ x: Math.round(ground.x), y: Math.round(ground.y) });
    liftCache.set(key, frames);
  }
  return frames;
}

const CREATE: Record<CharacterKind, readonly Keyframe[]> = {
  // Pulls it out of the ground like a carrot.
  bunny: [
    { t: 0, p: { ...down(22), squash: 0.05 }, form: "speaker", arms: "down" },
    { t: 250, c: { squash: 0.85, arm: 40 } },
    { t: 480, c: { tilt: -10, squash: 0.95 }, p: { squash: 0.3 }, fx: [["dirt", 22, 4]] },
    { t: 640, c: { tilt: 0, squash: 0.86 } },
    { t: 880, c: { tilt: -14, squash: 0.95 }, p: { squash: 0.62 }, fx: [["dirt", 22, 4]] },
    { t: 1000, c: { tilt: 0, squash: 0.78, arm: 0 } },
    { t: 1240, c: { hop: 28, squash: 1.08, sway: 26 }, p: { x: 0, y: 74, squash: 1 }, arms: "up", ease: "out", fx: [["dirt", 22, 4], ["sparkle", 0, 90]] },
    { t: 1500, c: NEUTRAL, p: CARRY, ease: "in" },
  ],
  // Stalks a ball of yarn and pounces; the yarn turns out to be a speaker.
  cat: [
    { t: 0, p: { x: 70, y: 0, scale: 0.69, squash: 1, spin: 0, opacity: 0 }, form: "yarn", arms: "down" },
    { t: 300, p: { x: 30, spin: -360, opacity: 1 }, c: { squash: 0.84 } },
    { t: 420, c: { tilt: 7, sway: 8 } },
    { t: 540, c: { tilt: -7, sway: -8 } },
    { t: 660, c: { tilt: 7, sway: 8 } },
    { t: 860, c: { hop: 20, shiftX: 12, tilt: 14, squash: 1.05, sway: 0 }, ease: "out" },
    { t: 1000, c: { hop: 0, shiftX: 20, tilt: 0, squash: 0.85 }, ease: "in", fx: [["puff", 30, 14]] },
    { t: 1010, form: "speaker", p: { scale: 0.42, spin: 0 } },
    { t: 1260, p: { scale: 1.14 }, c: { shiftX: 0, squash: 1 }, ease: "out", fx: [["sparkle", 30, 50]] },
    { t: 1340, p: { scale: 1 }, arms: "up" },
    { t: 1600, p: CARRY, ease: "out" },
  ],
  // Claps twice; the speaker drops from the sky into its arms.
  bear: [
    { t: 0, p: { ...CARRY, y: 320, opacity: 0 }, form: "speaker", arms: "down" },
    { t: 140, c: { open: 75 } },
    { t: 230, c: { open: -12 }, fx: [["sparkle", 14, 28]] },
    { t: 370, c: { open: 75 } },
    { t: 460, c: { open: -12 }, fx: [["sparkle", 14, 28]] },
    { t: 560, c: { open: 0, tilt: -6 }, arms: "up", p: { opacity: 1, spin: 300 } },
    { t: 1020, p: { y: 46, spin: 0 }, ease: "in" },
    { t: 1130, c: { squash: 0.8, tilt: 0 }, p: { y: 34 }, fx: [["puff", -18, 4], ["puff", 18, 4]] },
    { t: 1280, c: { squash: 1.06 }, p: { y: 50 } },
    { t: 1400, c: NEUTRAL, p: CARRY },
  ],
  // Leaps out of sight and comes back down holding it.
  frog: [
    { t: 0, p: { ...CARRY, opacity: 0 }, form: "speaker", arms: "down" },
    { t: 260, c: { squash: 0.68 } },
    { t: 600, c: { hop: 320, squash: 1.18 }, ease: "out" },
    { t: 700, arms: "up", ride: true, p: { opacity: 1 } },
    { t: 1150, c: { hop: 0, squash: 1.1 }, ease: "in" },
    { t: 1270, c: { squash: 0.7 }, fx: [["puff", -20, 4], ["puff", 20, 4]] },
    { t: 1500, c: NEUTRAL, ride: false, p: CARRY },
  ],
  // Lays an egg; the speaker hatches from it.
  chick: [
    { t: 0, p: { x: -22, y: 0, scale: 0.28, squash: 1, spin: 0, opacity: 0 }, form: "egg", arms: "down" },
    { t: 150, c: { squash: 0.82, shiftX: 2 } },
    { t: 300, c: { squash: 0.8, shiftX: -2 } },
    { t: 440, c: { squash: 0.7, shiftX: 0, sway: 10 } },
    { t: 600, c: { hop: 12, shiftX: 8, squash: 1.05, sway: 0 }, p: { scale: 0.97, opacity: 1 }, ease: "out", fx: [["puff", -22, 8]] },
    { t: 720, c: { hop: 0, squash: 1 }, ease: "in" },
    { t: 730, turn: -1 },
    { t: 860, p: { spin: 12 } },
    { t: 980, p: { spin: -12 }, fx: [["crack", -22, 26]] },
    { t: 1090, p: { spin: 10 } },
    { t: 1100, form: "speaker", p: { scale: 0.56, spin: 0 }, fx: [["crumbs", -22, 26], ["sparkle", -22, 40]] },
    { t: 1350, p: { scale: 1 }, c: { hop: 8 }, ease: "out" },
    { t: 1450, c: { hop: 0 }, turn: 1, arms: "up" },
    { t: 1700, p: CARRY, c: { shiftX: 0 }, ease: "out" },
  ],
  // Spins in a cloud of smoke; a leaf floats down and becomes the speaker.
  fox: [
    { t: 0, p: { x: 0, y: 130, scale: 0.76, squash: 1, spin: 0, opacity: 0 }, form: "leaf", arms: "down" },
    { t: 150, c: { open: 110, hop: 6 }, fx: [["puff", -16, 20]] },
    { t: 250, turn: -1 },
    { t: 350, turn: 1, fx: [["puff", 16, 30]] },
    { t: 450, turn: -1 },
    { t: 550, turn: 1, fx: [["puff", -14, 40]] },
    { t: 650, turn: -1 },
    { t: 750, turn: 1, c: { open: 0, hop: 0 }, p: { opacity: 1 }, fx: [["puff", 0, 120]] },
    { t: 850, p: { x: 12, y: 104, spin: 24 } },
    { t: 950, p: { x: -10, y: 80, spin: -24 } },
    { t: 1050, p: { x: 0, y: 58, spin: 0 }, arms: "up" },
    { t: 1060, form: "speaker", p: { scale: 0.42 }, fx: [["sparkle", 0, 76], ["leaves", 0, 70]] },
    { t: 1230, p: { scale: 1.17, y: 50 }, ease: "out" },
    { t: 1400, p: CARRY },
  ],
  // Slides away on its belly and comes back pushing the speaker.
  penguin: [
    { t: 0, p: { ...down(200), opacity: 0 }, form: "speaker", arms: "down" },
    { t: 200, c: { tilt: 82, hop: 4 } },
    { t: 700, c: { shiftX: 170 }, ease: "out", fx: [["puff", 30, 4]] },
    { t: 710, turn: -1, p: { opacity: 1 } },
    { t: 800, p: { x: 200 }, fx: [["puff", 170, 4]] },
    { t: 1400, c: { shiftX: 30 }, p: { x: 0 }, ease: "out" },
    { t: 1410, turn: 1 },
    { t: 1560, c: { tilt: 0, hop: 0, shiftX: 0 }, arms: "up", p: { x: 0, y: 14 } },
    { t: 1800, p: CARRY, ease: "out" },
  ],
  // Digs it up with its snout.
  pig: [
    { t: 0, p: { ...down(26), squash: 0.05 }, form: "speaker", arms: "down" },
    { t: 150, c: { tilt: 34 } },
    { t: 250, c: { tilt: 52 }, p: { squash: 0.34 }, fx: [["dirt", 26, 4]] },
    { t: 350, c: { tilt: 34 } },
    { t: 450, c: { tilt: 52 }, p: { squash: 0.66 }, fx: [["dirt", 26, 4]] },
    { t: 550, c: { tilt: 34 } },
    { t: 650, c: { tilt: 52 }, p: { squash: 1 }, fx: [["dirt", 26, 4]] },
    { t: 760, c: { tilt: 0 } },
    { t: 930, c: { hop: 14, sway: 14 }, ease: "out" },
    { t: 1090, c: { hop: 0, sway: 0 }, ease: "in" },
    { t: 1180, arms: "up", p: { x: 22, y: 14 } },
    { t: 1420, p: { x: 6, y: 62 }, ease: "out" },
    { t: 1600, p: CARRY },
  ],
  // Somersaults forward and comes up with it.
  panda: [
    { t: 0, p: { ...down(44), scale: 0.42, opacity: 0 }, form: "speaker", arms: "down" },
    { t: 200, c: { squash: 0.8 } },
    { t: 520, c: { tilt: 180, shiftX: 20, hop: 10, squash: 0.9 } },
    { t: 860, c: { tilt: 360, shiftX: 40, hop: 0, squash: 0.85 }, fx: [["puff", 40, 4]] },
    { t: 960, c: { squash: 1 }, p: { opacity: 1 }, fx: [["sparkle", 44, 30]] },
    { t: 1160, p: { scale: 1, x: 40, y: 46 }, arms: "up", ease: "out" },
    { t: 1170, ride: true, p: { x: 0 } },
    { t: 1500, c: { shiftX: 0 }, walk: true },
  ],
  // Pumps a crumb-sized speaker up to full size.
  mouse: [
    { t: 0, p: { ...down(24), scale: 0.17 }, form: "speaker", arms: "down" },
    { t: 180, c: { tilt: 18, open: 40 } },
    { t: 290, c: { squash: 0.8, open: 0 }, p: { scale: 0.42 }, fx: [["puff", 24, 6]] },
    { t: 400, c: { squash: 1, open: 40 }, p: { scale: 0.36 } },
    { t: 510, c: { squash: 0.8, open: 0 }, p: { scale: 0.64 }, fx: [["puff", 24, 10]] },
    { t: 620, c: { squash: 1, open: 40 }, p: { scale: 0.58 } },
    { t: 730, c: { squash: 0.8, open: 0 }, p: { scale: 0.89 }, fx: [["puff", 24, 14]] },
    { t: 840, c: { squash: 1, open: 40 }, p: { scale: 0.83 } },
    { t: 950, c: { squash: 0.8, open: 0 }, p: { scale: 1.19 }, fx: [["puff", 24, 18]] },
    { t: 1100, c: { squash: 1, tilt: 0, sway: 12 }, p: { scale: 1 } },
    { t: 1250, c: { sway: -12 }, arms: "up", p: { y: 12 } },
    { t: 1500, c: { sway: 0 }, p: { x: 4, y: 60 }, ease: "out" },
    { t: 1700, p: CARRY },
  ],
};

const DISCARD: Record<CharacterKind, readonly Keyframe[]> = {
  // Sets it down and kicks it over the hedge.
  bunny: [
    HELD,
    { t: 250, p: down(24), ease: "in" },
    { t: 260, arms: "down" },
    { t: 450, c: { tilt: -16, hop: 6, sway: -14 } },
    { t: 590, c: { tilt: 22, hop: 16, shiftX: 8, sway: 20 }, fx: [["puff", 26, 16]] },
    { t: 850, c: { tilt: 0, hop: 0, shiftX: 0, sway: 0 }, p: { x: 120, y: 150, spin: 300, scale: 0.76 }, ease: "out" },
    { t: 1150, p: { x: 250, y: 70, spin: 720, scale: 0.42, opacity: 0 }, ease: "in" },
    { t: 1220, c: { hop: 8 } },
    { t: 1300, c: { hop: 0 } },
  ],
  // Nudges it closer and closer to the edge, then swipes it off.
  cat: [
    HELD,
    { t: 280, p: down(22), ease: "in" },
    { t: 290, arms: "down" },
    { t: 480, c: { arm: 50 }, p: { x: 30 } },
    { t: 640, c: { arm: 0 } },
    { t: 860, c: { arm: 50 }, p: { x: 38 } },
    { t: 1020, c: { arm: 0, sway: 10 } },
    { t: 1180, c: { arm: 85, tilt: 10, sway: 0 }, p: { x: 72, spin: 20 }, fx: [["puff", 44, 20]] },
    { t: 1320, c: { arm: 0, tilt: 0, squash: 0.92 }, p: { x: 84, y: -30, spin: 70 }, ease: "in" },
    { t: 1600, p: { x: 92, y: -230, spin: 150, opacity: 0 }, ease: "in" },
    { t: 1700, c: { squash: 1 } },
  ],
  // Gives it a bear hug until it pops.
  bear: [
    HELD,
    { t: 280, p: { x: 8, y: 12 }, ease: "in" },
    { t: 290, arms: "down", c: { open: -26 } },
    { t: 520, c: { tilt: 5, squash: 0.94 }, p: { scale: 0.81, squash: 1.3 } },
    { t: 740, c: { tilt: -5 }, p: { scale: 0.64, squash: 1.6 } },
    { t: 900, c: { tilt: 4 }, p: { scale: 0.5, squash: 1.9 } },
    { t: 930, p: { scale: 1.39, squash: 1, opacity: 0 }, fx: [["puff", 8, 36], ["sparkle", 8, 40], ["crumbs", 8, 30]] },
    { t: 1100, c: { hop: 10, open: 85, tilt: 0, squash: 1.05 }, ease: "out" },
    { t: 1250, c: { hop: 0, squash: 1 }, ease: "in" },
    { t: 1400, c: { open: 0 } },
  ],
  // Swallows it whole.
  frog: [
    HELD,
    { t: 250, p: { x: 30, y: 22 }, ease: "in" },
    { t: 260, arms: "down" },
    { t: 440, c: { squash: 1.16, tilt: -9 } },
    { t: 640, c: { shiftX: 10, tilt: 10, squash: 1 }, p: { x: 12, y: 24, scale: 0.19 }, ease: "in" },
    { t: 650, p: HIDDEN },
    { t: 800, c: { shiftX: 0, tilt: 0, squash: 0.8 } },
    { t: 960, c: { squash: 1.26 } },
    { t: 1150, c: { squash: 1.2, hop: 4 } },
    { t: 1230, c: { squash: 1.05, hop: 0 }, fx: [["puff", 22, 34]] },
    { t: 1400, c: NEUTRAL },
  ],
  // Pecks it to crumbs.
  chick: [
    HELD,
    { t: 250, p: down(24), ease: "in" },
    { t: 260, arms: "down" },
    { t: 360, c: { tilt: 42 }, p: { scale: 0.83, spin: 6 }, fx: [["crumbs", 24, 24]] },
    { t: 460, c: { tilt: 0 } },
    { t: 560, c: { tilt: 42 }, p: { scale: 0.67, spin: -6 }, fx: [["crumbs", 24, 20]] },
    { t: 660, c: { tilt: 0 } },
    { t: 760, c: { tilt: 42 }, p: { scale: 0.49, spin: 6 }, fx: [["crumbs", 24, 16]] },
    { t: 860, c: { tilt: 0 } },
    { t: 960, c: { tilt: 42 }, p: { scale: 0.28, spin: -6 }, fx: [["crumbs", 24, 10]] },
    { t: 1060, c: { tilt: 0 } },
    { t: 1160, c: { tilt: 46 }, p: { scale: 0.07, opacity: 0 }, fx: [["crumbs", 24, 6]] },
    { t: 1280, c: { tilt: 0, hop: 12, sway: 14 }, ease: "out" },
    { t: 1400, c: { hop: 0 }, ease: "in" },
    { t: 1500, c: { hop: 10, sway: -14 }, ease: "out" },
    { t: 1600, c: { hop: 0, sway: 0 }, ease: "in" },
  ],
  // Tosses it up, turns it into a leaf and bows as the leaf drifts away.
  fox: [
    HELD,
    { t: 240, p: { y: 150, spin: 180 }, ease: "out" },
    { t: 250, arms: "down", c: { open: 120 } },
    { t: 340, fx: [["puff", 0, 170], ["leaves", 0, 170]] },
    { t: 350, form: "leaf", p: { scale: 0.83, spin: 0 } },
    { t: 450, turn: -1, c: { open: 0 } },
    { t: 560, turn: 1, p: { x: 20, y: 120, spin: 28 } },
    { t: 760, p: { x: -16, y: 84, spin: -28 } },
    { t: 960, c: { tilt: 16 }, p: { x: 14, y: 46, spin: 28 } },
    { t: 1180, p: { x: -6, y: 10, spin: -10, opacity: 0 } },
    { t: 1300, c: { tilt: 0 } },
  ],
  // Slaps it with a flipper and waves as it slides away over the ice.
  penguin: [
    HELD,
    { t: 250, p: down(24), ease: "in" },
    { t: 260, arms: "down" },
    { t: 450, c: { tilt: -12, open: 60 } },
    { t: 540, c: { tilt: 14, open: 0, arm: 70 }, fx: [["puff", 26, 24]] },
    { t: 760, c: { tilt: 0, arm: 0 }, p: { x: 150, spin: 4 }, ease: "out" },
    { t: 900, c: { open: 130 }, p: { x: 210, spin: -4 } },
    { t: 1020, c: { open: 90 } },
    { t: 1140, c: { open: 130 }, p: { x: 290, spin: 3 } },
    { t: 1260, c: { open: 90 }, p: { x: 330, opacity: 0 } },
    { t: 1400, c: { open: 0 } },
  ],
  // Jumps up and sits on it until it is flat.
  pig: [
    HELD,
    { t: 250, p: down(24), ease: "in" },
    { t: 260, arms: "down" },
    { t: 430, c: { squash: 0.74 } },
    { t: 760, c: { hop: 76, shiftX: 24, squash: 1.1, sway: 16 }, ease: "out" },
    { t: 980, c: { hop: 10, squash: 0.9, sway: 0 }, p: { squash: 0.14, scale: 1.25 }, ease: "in", fx: [["puff", 0, 4], ["puff", 48, 4]] },
    { t: 1080, c: { hop: 20, squash: 1.05 }, ease: "out" },
    { t: 1180, c: { hop: 4, squash: 0.9 }, p: { squash: 0.05 }, ease: "in", fx: [["crumbs", 24, 4]] },
    { t: 1300, p: { opacity: 0 }, c: { hop: 0, squash: 1 } },
    { t: 1500, c: { shiftX: 0 }, walk: true },
  ],
  // Rolls it away like a ball and tumbles after it.
  panda: [
    HELD,
    { t: 250, p: down(26), ease: "in" },
    { t: 260, arms: "down", c: { open: -20 } },
    { t: 480, c: { squash: 0.8 } },
    { t: 640, c: { shiftX: 10, tilt: 14, squash: 1 }, fx: [["puff", 26, 20]] },
    { t: 840, c: { tilt: 190, shiftX: 24, hop: 8 }, p: { x: 100, y: 10, spin: 360, scale: 0.89 } },
    { t: 1040, c: { tilt: 360, shiftX: 36, hop: 0, open: 0 }, p: { x: 180, y: 0, spin: 720, scale: 0.78 } },
    { t: 1200, c: { squash: 0.9 }, p: { x: 240, y: 6, spin: 900, scale: 0.69 } },
    { t: 1350, p: { x: 300, y: 0, spin: 1080, scale: 0.62, opacity: 0 } },
    { t: 1500, c: { shiftX: 0, squash: 1 }, walk: true },
  ],
  // Nibbles it away from the top.
  mouse: [
    HELD,
    { t: 250, p: down(22), ease: "in" },
    { t: 260, arms: "down" },
    { t: 360, c: { shiftX: 6, tilt: 14 }, p: { squash: 0.8 }, fx: [["crumbs", 22, 40]] },
    { t: 460, c: { tilt: 4 } },
    { t: 560, c: { tilt: 16 }, p: { squash: 0.6 }, fx: [["crumbs", 22, 32]] },
    { t: 660, c: { tilt: 6 } },
    { t: 760, c: { tilt: 20 }, p: { squash: 0.42 }, fx: [["crumbs", 22, 24]] },
    { t: 860, c: { tilt: 10 } },
    { t: 960, c: { tilt: 26 }, p: { squash: 0.24 }, fx: [["crumbs", 22, 16]] },
    { t: 1060, c: { tilt: 14 } },
    { t: 1160, c: { tilt: 32 }, p: { squash: 0.1 }, fx: [["crumbs", 22, 8]] },
    { t: 1380, c: { tilt: 0, shiftX: 0 }, p: { x: 10, y: 22, scale: 0.14, opacity: 0 } },
    { t: 1500, c: { squash: 1.14, hop: 6 } },
    { t: 1700, c: { squash: 1, hop: 0 } },
  ],
};

/** The keyframes of an action for a character. */
export function actionFrames(kind: CharacterKind, name: ActionName, ground?: GroundSpot): readonly Keyframe[] {
  return name === "lift" || name === "putDown" ? liftFor(ground) : name === "create" ? CREATE[kind] : DISCARD[kind];
}

/**
 * How far a lifted or put down speaker has travelled along the ground from where it stands (0) to the character
 * (1), `ms` into the action. Only the sideways part of the motion counts; being raised overhead does not move the
 * speaker's sound. The lift frames scale every sideways position with the ground spot, so the share is the same
 * for any spot.
 */
export function liftTravel(kind: CharacterKind, name: "lift" | "putDown", ms: number): number {
  const x = actionAt(kind, name, ms).prop.x;
  return Math.max(0, Math.min(1, 1 - x / DEFAULT_GROUND.x));
}

/** Length of an action in milliseconds. */
export function actionDuration(kind: CharacterKind, name: ActionName): number {
  const frames = actionFrames(kind, name);
  return frames[frames.length - 1].t;
}

interface Resolved {
  t: number;
  stance: Stance;
  /** Prop as stored, before riding the character. */
  prop: PropState;
  arms: "up" | "down";
  form: PropForm;
  turn: 1 | -1;
  ride: boolean;
  walk: boolean;
  ease?: "in" | "out" | "inOut";
}

const cache = new WeakMap<readonly Keyframe[], Resolved[]>();

/** Fills every keyframe with the values carried over from the ones before it. */
function resolve(frames: readonly Keyframe[]): Resolved[] {
  let known = cache.get(frames);
  if (known) return known;
  known = [];
  let state: Resolved = { t: 0, stance: NEUTRAL, prop: { ...CARRY, opacity: 0 }, arms: "down", form: "speaker", turn: 1, ride: false, walk: false };
  for (const frame of frames) {
    state = {
      t: frame.t,
      stance: { ...state.stance, ...frame.c },
      prop: { ...state.prop, ...frame.p },
      arms: frame.arms ?? state.arms,
      form: frame.form ?? state.form,
      turn: frame.turn ?? state.turn,
      ride: frame.ride ?? state.ride,
      walk: frame.walk ?? false,
      ease: frame.ease,
    };
    known.push(state);
  }
  cache.set(frames, known);
  return known;
}

const mix = (from: number, to: number, ratio: number) => from + (to - from) * ratio;
function blend<T extends object>(from: T, to: T, ratio: number): T {
  const result = {} as Record<string, number>;
  for (const key of Object.keys(from)) result[key] = mix((from as Record<string, number>)[key], (to as Record<string, number>)[key], ratio);
  return result as T;
}
const riding = (state: Resolved): PropState => (state.ride ? { ...state.prop, x: state.prop.x + state.stance.shiftX, y: state.prop.y + state.stance.hop } : state.prop);

/** The character and the prop `ms` milliseconds into an action. After the end it stays on the last keyframe. */
export function actionAt(kind: CharacterKind, name: ActionName, ms: number, ground?: GroundSpot): ActionMoment {
  if (name === "putDown") {
    const length = actionDuration(kind, "lift");
    return { ...actionAt(kind, "lift", length - Math.max(0, Math.min(length, ms)), ground), done: ms >= length };
  }
  const frames = actionFrames(kind, name, ground);
  const states = resolve(frames);
  const last = states[states.length - 1];
  const time = Math.max(0, Math.min(last.t, ms));
  let index = states.findIndex((state) => state.t > time);
  if (index === -1) index = states.length;
  const from = states[Math.max(0, index - 1)];
  const to = states[Math.min(states.length - 1, index)];
  let ratio = to.t > from.t ? (time - from.t) / (to.t - from.t) : 1;
  if (to.ease === "out") ratio = 1 - (1 - ratio) * (1 - ratio);
  else if (to.ease === "in") ratio = ratio * ratio;
  else if (to.ease === "inOut") ratio = ratio * ratio * (3 - 2 * ratio);
  const effects: ActionMoment["effects"] = [];
  for (const frame of frames) {
    if (!frame.fx || ms < frame.t || ms >= frame.t + FX_MS) continue;
    for (const [fxKind, x, y] of frame.fx) effects.push({ kind: fxKind, x, y, progress: (ms - frame.t) / FX_MS });
  }
  return {
    stance: blend(from.stance, to.stance, ratio),
    prop: blend(riding(from), riding(to), ratio),
    arms: from.arms,
    form: from.form,
    turn: from.turn,
    walk: to.walk,
    effects,
    done: ms >= last.t,
  };
}
