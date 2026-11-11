/** Speaker sound model and distance mixing. There is one kind of speaker; every speaker has all of these controls. */
import { flatEqualizer, normalizeEqualizer, type Equalizer } from "./equalizer";
import { TILE_WIDTH, distance, toScreen, type Point } from "./world";

export type NoiseColor = "white" | "pink" | "brown";
export type Wave = "sine" | "triangle" | "square" | "sawtooth";

export interface Oscillator {
  wave: Wave;
  /** Hz */
  frequency: number;
  /** 0 to 1 */
  level: number;
}

export interface SpeakerSound {
  /** Overall loudness, 0 to 1. */
  volume: number;
  /** How far the speaker is heard, in tiles. */
  radius: number;
  noise: { color: NoiseColor; level: number };
  /** Low drone under the noise that helps mask rumble. */
  bass: { frequency: number; level: number };
  /** Up to MAX_OSCILLATORS synthesised tones. */
  oscillators: Oscillator[];
  /** One five-band curve: low cut, low shelf, bell, high shelf and high cut. */
  eq: Equalizer;
}

export interface Speaker {
  id: string;
  name: string;
  x: number;
  y: number;
  sound: SpeakerSound;
}

export const MAX_OSCILLATORS = 3;
export const MAX_SPEAKERS = 24;
export const LIMITS = {
  radius: [2, 18],
  bassFrequency: [30, 140],
  oscillatorFrequency: [20, 8000],
} as const;

const COLORS: NoiseColor[] = ["white", "pink", "brown"];
const WAVES: Wave[] = ["sine", "triangle", "square", "sawtooth"];

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}
const unit = (value: unknown, fallback: number) => num(value, [0, 1], fallback);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/** A gentle brown noise with a low drone: the sound a new speaker starts with. */
export function defaultSound(): SpeakerSound {
  return {
    volume: 0.7,
    radius: 8,
    noise: { color: "brown", level: 0.8 },
    bass: { frequency: 55, level: 0.35 },
    oscillators: [],
    eq: flatEqualizer(),
  };
}

/** Turns any stored or received value into a valid sound: missing fields get defaults and numbers are clamped. */
export function normalizeSound(value: unknown): SpeakerSound {
  const base = defaultSound();
  const v = record(value);
  const noise = record(v.noise);
  const bass = record(v.bass);
  const oscillators = (Array.isArray(v.oscillators) ? v.oscillators : []).slice(0, MAX_OSCILLATORS).map((item) => {
    const o = record(item);
    return {
      wave: WAVES.includes(o.wave as Wave) ? (o.wave as Wave) : "sine",
      frequency: num(o.frequency, LIMITS.oscillatorFrequency, 220),
      level: unit(o.level, 0.2),
    };
  });
  return {
    volume: unit(v.volume, base.volume),
    radius: num(v.radius, LIMITS.radius, base.radius),
    noise: { color: COLORS.includes(noise.color as NoiseColor) ? (noise.color as NoiseColor) : base.noise.color, level: unit(noise.level, base.noise.level) },
    bass: { frequency: num(bass.frequency, LIMITS.bassFrequency, base.bass.frequency), level: unit(bass.level, base.bass.level) },
    oscillators,
    eq: normalizeEqualizer(v.eq, v.filter),
  };
}

/** Loudness of a speaker heard from `tiles` away: full at the speaker, fading smoothly to silence at its radius. */
export function gainAt(tiles: number, radius: number): number {
  if (!(radius > 0) || tiles >= radius) return 0;
  const closeness = 1 - Math.max(0, tiles) / radius;
  return closeness * closeness;
}

/** Left/right balance (-1 to 1) of a source seen from the listener, following the on-screen direction. */
export function panFor(listener: Point, source: Point, radius: number): number {
  const dx = toScreen(source).x - toScreen(listener).x;
  const pan = dx / (Math.max(1, radius) * (TILE_WIDTH / 2));
  return Math.max(-1, Math.min(1, pan)) * 0.8;
}

export interface SpeakerLevel {
  id: string;
  gain: number;
  pan: number;
}

/**
 * What the listener hears from each speaker. Speakers in range are summed, so two nearby speakers blend;
 * when the sum would get louder than one speaker at full volume, all are scaled down together.
 */
export function mixFor(listener: Point, speakers: readonly Speaker[]): SpeakerLevel[] {
  const levels = speakers.map((speaker) => ({
    id: speaker.id,
    gain: gainAt(distance(listener, speaker), speaker.sound.radius) * speaker.sound.volume,
    pan: panFor(listener, speaker, speaker.sound.radius),
  }));
  const power = Math.sqrt(levels.reduce((sum, level) => sum + level.gain * level.gain, 0));
  const scale = power > 1 ? 1 / power : 1;
  return levels.map((level) => ({ ...level, gain: level.gain * scale }));
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
