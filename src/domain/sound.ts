/**
 * Speaker sound model and distance mixing. A speaker plays either the synthesiser (noise, oscillators and an
 * equalizer) or one nature source, which has only a volume and is drawn as its own object.
 */
import { flatEqualizer, normalizeEqualizer, type Equalizer } from "./equalizer";
import { DEFAULT_TEMPO, TEMPO, defaultRecording, hasTempo, recordingOf } from "./recordings";
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

/**
 * Nature sources in the order the sound picker shows them: first those a long crossfaded recording covers, then
 * those with events on a bed, then those with a rhythm. The heartbeat is played beat by beat at a tempo.
 */
export const NATURE_SOURCES = ["rain", "stream", "waterfall", "reeds", "airplane", "campfire", "waves", "cafe", "train", "heartbeat"] as const;
export type NatureSource = (typeof NATURE_SOURCES)[number];
export type SoundSource = "synth" | NatureSource;

/**
 * A synthesiser sound. There is no overall volume: the noise and each oscillator have their own volume (`level`,
 * 0 to 1), and the loudest of them decides how far the speaker is heard (see reachOf()).
 */
export interface SynthSound {
  source: "synth";
  noise: { color: NoiseColor; level: number };
  /** Up to MAX_OSCILLATORS synthesised tones (OSC A and OSC B), each with its own volume. The default sound uses OSC A for its low end. */
  oscillators: Oscillator[];
  /** One five-band curve: low cut, low shelf, bell, high shelf and high cut. */
  eq: Equalizer;
  /** When true, the speaker disables left/right panning and plays in mono. Omitted when stereo. */
  mono?: boolean;
}

/**
 * A nature source: its recording takes the place of the synthesiser's noise; the oscillators and the equalizer
 * work as for the synthesiser. There is no default oscillator.
 */
export interface NatureSound {
  source: NatureSource;
  /** Which of the source's recordings plays: its id in RECORDINGS (see recordings.ts). */
  recording: string;
  /** Heartbeat only: beats per minute, TEMPO[0] to TEMPO[1]. */
  tempo?: number;
  /** Volume of the recording, 0 to 1, in the place of the synthesiser's noise volume. */
  level: number;
  oscillators: Oscillator[];
  eq: Equalizer;
  /** When true, the speaker disables left/right panning and downmixes its recording to mono. Omitted when stereo. */
  mono?: boolean;
}

export type SpeakerSound = SynthSound | NatureSound;

/** How a speaker looks: a speaker cabinet in its noise colour, or the object of its nature source. */
export type SourceLook = NoiseColor | NatureSource;

export const isSynth = (sound: SpeakerSound): sound is SynthSound => sound.source === "synth";
export const isNatureSource = (value: unknown): value is NatureSource => NATURE_SOURCES.includes(value as NatureSource);
export const isMono = (sound: SpeakerSound): boolean => sound.mono === true;
export const lookOf = (sound: SpeakerSound): SourceLook => (isSynth(sound) ? sound.noise.color : sound.source);
/** Volume of the noise (synthesiser) or of the recording (nature source): the one volume of the Sound tab. */
export const baseLevel = (sound: SpeakerSound): number => (isSynth(sound) ? sound.noise.level : sound.level);
/** Volume of the loudest part, noise or recording or an oscillator. It decides the reach and the waves. */
export const loudnessOf = (sound: SpeakerSound): number => Math.max(baseLevel(sound), ...sound.oscillators.map((oscillator) => oscillator.level));

/** A nature sound with its default recording, and the default tempo when the source has one. */
export function natureSound(source: NatureSource, rest: Pick<NatureSound, "level" | "oscillators" | "eq" | "mono">): NatureSound {
  return { source, recording: defaultRecording(source), ...(hasTempo(source) ? { tempo: DEFAULT_TEMPO } : null), ...rest };
}

/** Returns `sound` set to mono or stereo while keeping every other setting intact. */
export function withMono(sound: SpeakerSound, mono: boolean): SpeakerSound {
  if (mono) return { ...sound, mono: true };
  const copy = { ...sound };
  delete copy.mono;
  return copy;
}

/**
 * The sound after choosing a source in the editor. The Sound tab volume (noise or recording), the channel mode
 * (stereo or mono) and the equalizer always stay. Going from the synthesiser to a nature source empties the
 * oscillators, since a nature source has none by default; between nature sources they stay; going back to the
 * synthesiser keeps them and takes the default noise colour. A new nature source starts with its first recording
 * (and the default tempo).
 */
export function withSource(sound: SpeakerSound, source: SoundSource): SpeakerSound {
  if (source === sound.source) return sound;
  const level = baseLevel(sound);
  const { eq } = sound;
  const mono = sound.mono ? { mono: true } : null;
  if (source === "synth") return { source, noise: { color: defaultSound().noise.color, level }, oscillators: sound.oscillators, eq, ...mono };
  return natureSound(source, { level, oscillators: isSynth(sound) ? [] : sound.oscillators, eq, ...mono });
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
/** Reach in tiles of a silent speaker and of one whose loudest part is at full volume. */
export const REACH = [2, 11] as const;
/** The rain recording a stored thunder source turns into. */
const THUNDER_RECORDING = "fs-737691";
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
  return index === 0 ? { wave: "sine", frequency: 55, level: 0.5 } : { wave: "sine", frequency: 165, level: 0.15 };
}

/** A gentle brown noise with a low sine under it: the sound a new speaker starts with. It reaches 8.3 tiles. */
export function defaultSound(): SynthSound {
  return {
    source: "synth",
    noise: { color: "brown", level: 0.7 },
    oscillators: [defaultOscillator(0)],
    eq: flatEqualizer(),
  };
}

/** Silent version of the default sound used when a player first creates a new speaker. */
export function quietSound(): SynthSound {
  const base = defaultSound();
  return {
    ...base,
    noise: { ...base.noise, level: 0 },
    oscillators: base.oscillators.map((osc) => ({ ...osc, level: 0 })),
  };
}

/**
 * Turns any stored or received value into a valid sound: missing fields get defaults and numbers are clamped.
 * Sounds saved before the bass drone was removed carry `bass`; it becomes a sine oscillator of the same loudness
 * placed before the others. A former `radius` is ignored. A value without a source, as every sound saved before
 * nature sources existed, is a synthesiser sound; a nature source keeps its recording volume, oscillators and
 * equalizer.
 *
 * Sounds saved before part volumes carry an overall `volume` that multiplied every part. It is folded into each
 * part (noise or recording, oscillators), so they sound the same; a nature source of that time had only `volume`,
 * which becomes its recording volume.
 */
export function normalizeSound(value: unknown): SpeakerSound {
  const base = defaultSound();
  const v = record(value);
  const legacy = typeof v.volume === "number" && Number.isFinite(v.volume);
  const overall = legacy ? unit(v.volume, 1) : 1;
  const stored: Oscillator[] = (Array.isArray(v.oscillators) ? v.oscillators : []).map((item) => {
    const o = record(item);
    return {
      wave: WAVES.includes(o.wave as Wave) ? (o.wave as Wave) : "sine",
      frequency: num(o.frequency, LIMITS.oscillatorFrequency, 220),
      level: unit(o.level, 0.2) * overall,
    };
  });
  const mono = v.mono === true ? { mono: true } : null;
  // A nature source has no default oscillator and no noise; it never had a bass drone. Thunder became a rain
  // recording; a stored thunder plays rain with that recording.
  const source = v.source === "thunder" ? "rain" : v.source;
  if (isNatureSource(source)) {
    const level = typeof v.level === "number" ? unit(v.level, base.noise.level) * overall : legacy ? overall : base.noise.level;
    const recording = recordingOf(source, v.source === "thunder" ? THUNDER_RECORDING : v.recording);
    const tempo = hasTempo(source) ? { tempo: Math.round(num(v.tempo, TEMPO, DEFAULT_TEMPO)) } : null;
    return { source, recording, ...tempo, level, oscillators: stored.slice(0, MAX_OSCILLATORS), eq: normalizeEqualizer(v.eq), ...mono };
  }
  const noise = record(v.noise);
  const bass = record(v.bass);
  const bassLevel = v.bass ? unit(bass.level, 0.35) : 0;
  const fromBass: Oscillator[] = bassLevel > 0 ? [{ wave: "sine", frequency: num(bass.frequency, LIMITS.oscillatorFrequency, 55), level: Math.min(1, bassLevel * BASS_TO_OSCILLATOR) * overall }] : [];
  // A value that says nothing about tones gets the default low hum (at the old default level when it is old).
  const silentOnTones = !Array.isArray(v.oscillators) && !v.bass;
  const hum = legacy ? [{ ...defaultOscillator(0), level: 0.55 * overall }] : base.oscillators;
  return {
    source: "synth",
    noise: { color: NOISE_COLORS.includes(noise.color as NoiseColor) ? (noise.color as NoiseColor) : base.noise.color, level: unit(noise.level, legacy ? 0.8 : base.noise.level) * overall },
    oscillators: silentOnTones ? hum : [...fromBass, ...stored].slice(0, MAX_OSCILLATORS),
    eq: normalizeEqualizer(v.eq, v.filter),
    ...mono,
  };
}

/** How far a speaker is heard, in tiles. There is no separate setting: the louder its loudest part, the farther. */
export function reachOf(sound: SpeakerSound): number {
  return REACH[0] + (REACH[1] - REACH[0]) * Math.max(0, Math.min(1, loudnessOf(sound)));
}

/** Share of full loudness heard `tiles` away from a point with the given reach: 1 at the point, 0 at the reach. */
export function gainAt(tiles: number, radius: number): number {
  if (!(radius > 0) || tiles >= radius) return 0;
  const closeness = 1 - Math.max(0, tiles) / radius;
  return closeness * closeness;
}

/** Loudness (0 to 1) of a speaker heard from `tiles` away: its loudest part, fading smoothly to silence at its reach. */
export function loudnessAt(tiles: number, sound: SpeakerSound): number {
  return gainAt(tiles, reachOf(sound)) * loudnessOf(sound);
}

/** Left/right balance (-1 to 1) of a source seen from the listener, following the on-screen direction. */
export function panFor(listener: Point, source: Point, radius: number): number {
  const dx = toScreen(source).x - toScreen(listener).x;
  const pan = dx / (Math.max(1, radius) * (TILE_WIDTH / 2));
  return Math.max(-1, Math.min(1, pan)) * 0.8;
}

export interface SpeakerLevel {
  id: string;
  /** The distance gain, already turned down with the mix. The parts carry their own volumes on top of it. */
  gain: number;
  pan: number;
}

/**
 * What the listener hears from each speaker. Speakers in range are summed, so two nearby speakers blend;
 * when the sum of their loudness would get louder than one speaker at full volume, all are scaled down together.
 */
export function mixFor(listener: Point, speakers: readonly Speaker[]): SpeakerLevel[] {
  const levels = speakers.map((speaker) => {
    const tiles = distance(listener, speaker);
    const reach = reachOf(speaker.sound);
    return { id: speaker.id, distanceGain: gainAt(tiles, reach), loudness: loudnessAt(tiles, speaker.sound), pan: isMono(speaker.sound) ? 0 : panFor(listener, speaker, reach) };
  });
  const power = Math.sqrt(levels.reduce((sum, level) => sum + level.loudness * level.loudness, 0));
  const scale = power > 1 ? 1 / power : 1;
  return levels.map((level) => ({ id: level.id, gain: level.distanceGain * scale, pan: level.pan }));
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
