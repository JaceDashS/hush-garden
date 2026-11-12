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
  /** Overall loudness, 0 to 1. It also decides how far the speaker is heard: see reachOf(). */
  volume: number;
  noise: { color: NoiseColor; level: number };
  /** Up to MAX_OSCILLATORS synthesised tones (OSC A and OSC B). The default sound uses OSC A for its low end. */
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

export const MAX_OSCILLATORS = 2;
export const MAX_SPEAKERS = 24;
export const LIMITS = {
  oscillatorFrequency: [20, 8000],
} as const;
/** Reach in tiles of a silent speaker and of a full-volume speaker. */
export const REACH = [2, 11] as const;
/** A stored bass drone played at 0.5 of its level; an oscillator plays at 0.3 of its level. */
const BASS_TO_OSCILLATOR = 0.5 / 0.3;

export const NOISE_COLORS: readonly NoiseColor[] = ["white", "pink", "brown"];
export const WAVES: readonly Wave[] = ["sine", "triangle", "square", "sawtooth"];

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}
const unit = (value: unknown, fallback: number) => num(value, [0, 1], fallback);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/** The oscillator a new panel starts with: OSC A is the low hum, OSC B a quiet tone above it. */
export function defaultOscillator(index: number): Oscillator {
  return index === 0 ? { wave: "sine", frequency: 55, level: 0.55 } : { wave: "sine", frequency: 165, level: 0.2 };
}

/** A gentle brown noise with a low sine under it: the sound a new speaker starts with. */
export function defaultSound(): SpeakerSound {
  return {
    volume: 0.7,
    noise: { color: "brown", level: 0.8 },
    oscillators: [defaultOscillator(0)],
    eq: flatEqualizer(),
  };
}

/**
 * Turns any stored or received value into a valid sound: missing fields get defaults and numbers are clamped.
 * Sounds saved before the bass drone was removed carry `bass`; it becomes a sine oscillator of the same loudness
 * placed before the others. A former `radius` is ignored.
 */
export function normalizeSound(value: unknown): SpeakerSound {
  const base = defaultSound();
  const v = record(value);
  const noise = record(v.noise);
  const bass = record(v.bass);
  const bassLevel = v.bass ? unit(bass.level, 0.35) : 0;
  const fromBass: Oscillator[] = bassLevel > 0 ? [{ wave: "sine", frequency: num(bass.frequency, LIMITS.oscillatorFrequency, 55), level: Math.min(1, bassLevel * BASS_TO_OSCILLATOR) }] : [];
  const stored: Oscillator[] = (Array.isArray(v.oscillators) ? v.oscillators : []).map((item) => {
    const o = record(item);
    return {
      wave: WAVES.includes(o.wave as Wave) ? (o.wave as Wave) : "sine",
      frequency: num(o.frequency, LIMITS.oscillatorFrequency, 220),
      level: unit(o.level, 0.2),
    };
  });
  // A value that says nothing about tones gets the default low hum.
  const silentOnTones = !Array.isArray(v.oscillators) && !v.bass;
  return {
    volume: unit(v.volume, base.volume),
    noise: { color: NOISE_COLORS.includes(noise.color as NoiseColor) ? (noise.color as NoiseColor) : base.noise.color, level: unit(noise.level, base.noise.level) },
    oscillators: silentOnTones ? base.oscillators : [...fromBass, ...stored].slice(0, MAX_OSCILLATORS),
    eq: normalizeEqualizer(v.eq, v.filter),
  };
}

/** How far a speaker is heard, in tiles. There is no separate setting: a louder speaker reaches farther. */
export function reachOf(sound: Pick<SpeakerSound, "volume">): number {
  return REACH[0] + (REACH[1] - REACH[0]) * Math.max(0, Math.min(1, sound.volume));
}

/** Share of full loudness heard `tiles` away from a point with the given reach: 1 at the point, 0 at the reach. */
export function gainAt(tiles: number, radius: number): number {
  if (!(radius > 0) || tiles >= radius) return 0;
  const closeness = 1 - Math.max(0, tiles) / radius;
  return closeness * closeness;
}

/** Loudness (0 to 1) of a speaker heard from `tiles` away: its volume, fading smoothly to silence at its reach. */
export function loudnessAt(tiles: number, sound: Pick<SpeakerSound, "volume">): number {
  return gainAt(tiles, reachOf(sound)) * sound.volume;
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
    gain: loudnessAt(distance(listener, speaker), speaker.sound),
    pan: panFor(listener, speaker, reachOf(speaker.sound)),
  }));
  const power = Math.sqrt(levels.reduce((sum, level) => sum + level.gain * level.gain, 0));
  const scale = power > 1 ? 1 / power : 1;
  return levels.map((level) => ({ ...level, gain: level.gain * scale }));
}

/** How many speakers the listener can currently hear. Shown in the status line. */
export function audibleCount(listener: Point, speakers: readonly Speaker[]): number {
  return speakers.filter((speaker) => loudnessAt(distance(listener, speaker), speaker.sound) > 0.01).length;
}

/**
 * A wave as `points` values from -1 to 1, for drawing it. `phase` 0 to 1 shifts the start and `cycles` is how
 * many times the wave repeats over the points.
 */
export function waveShape(wave: Wave, points: number, phase = 0, cycles = 1): number[] {
  return Array.from({ length: points }, (_, index) => {
    const t = ((((index / (points - 1)) * cycles + phase) % 1) + 1) % 1;
    switch (wave) {
      case "sine":
        return Math.sin(t * Math.PI * 2);
      case "triangle":
        return t < 0.25 ? t * 4 : t < 0.75 ? 2 - t * 4 : t * 4 - 4;
      case "square":
        return t < 0.5 ? 1 : -1;
      default:
        return t < 0.5 ? t * 2 : t * 2 - 2;
    }
  });
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
