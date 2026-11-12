/**
 * The speaker equalizer: one curve made of three points. Each point is one second-order filter whose kind can be
 * switched between a bell, a low cut, a low shelf, a high shelf and a high cut, and every kind has a width (Q).
 * The response is computed from the same coefficients the audio engine plays, so the drawn curve matches what
 * is heard.
 */

export type BandType = "bell" | "lowcut" | "lowshelf" | "highshelf" | "highcut";
export const BAND_TYPES: readonly BandType[] = ["bell", "lowcut", "lowshelf", "highshelf", "highcut"];

export interface EqBand {
  type: BandType;
  /** Centre or corner frequency in Hz. */
  frequency: number;
  /** Gain in dB. Ignored by the two cut kinds. */
  gain: number;
  /** Width of a bell, steepness of a shelf, resonance of a cut. */
  q: number;
}

export interface Equalizer {
  bands: [EqBand, EqBand, EqBand];
}

/** Number of points on the equalizer. */
export const BAND_COUNT = 3;
export const BAND_INDEXES: readonly number[] = [0, 1, 2];

export const EQ_LIMITS = {
  gain: [-24, 12],
  frequency: [20, 20000],
  q: [0.3, 8],
} as const;

/** Q of a flat shelf or cut (Butterworth); with it a shelf has the usual slope. */
export const NEUTRAL_Q = Math.SQRT1_2;

/** Frequency range of the graph. */
export const GRAPH_HZ = [20, 20000] as const;
/** Gain range of the graph in dB. */
export const GRAPH_DB = [-30, 18] as const;

export const isCut = (type: BandType): boolean => type === "lowcut" || type === "highcut";

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

const DEFAULT_BANDS: readonly EqBand[] = [
  { type: "lowshelf", frequency: 200, gain: 0, q: NEUTRAL_Q },
  { type: "bell", frequency: 1000, gain: 0, q: 1 },
  { type: "highshelf", frequency: 4000, gain: 0, q: NEUTRAL_Q },
];

export function flatEqualizer(): Equalizer {
  return { bands: [{ ...DEFAULT_BANDS[0] }, { ...DEFAULT_BANDS[1] }, { ...DEFAULT_BANDS[2] }] };
}

function normalizeBand(value: unknown, fallback: EqBand): EqBand {
  const v = record(value);
  const type = BAND_TYPES.includes(v.type as BandType) ? (v.type as BandType) : fallback.type;
  return {
    type,
    frequency: num(v.frequency, EQ_LIMITS.frequency, fallback.frequency),
    gain: num(v.gain, EQ_LIMITS.gain, fallback.gain),
    q: num(v.q, EQ_LIMITS.q, fallback.q),
  };
}

/**
 * Turns any stored or received value into a valid equalizer. Two older formats are still read so saved gardens
 * keep their sound: the five-band format (`highpass`, `lowShelf`, `bell`, `highShelf`, `lowpass`) and the first
 * format (`eq.low`, `eq.mid`, `eq.high` plus a separate `filter` object, passed as `legacyFilter`). A cut that
 * was set is kept in place of a shelf that was left flat.
 */
export function normalizeEqualizer(value: unknown, legacyFilter?: unknown): Equalizer {
  const v = record(value);
  if (Array.isArray(v.bands)) {
    const bands = v.bands as unknown[];
    return { bands: [0, 1, 2].map((index) => normalizeBand(bands[index], DEFAULT_BANDS[index])) as Equalizer["bands"] };
  }
  const old = record(legacyFilter);
  const lowShelf = record(v.lowShelf);
  const bell = record(v.bell ?? v.mid);
  const highShelf = record(v.highShelf);
  const highpass = num(v.highpass ?? old.highpass, EQ_LIMITS.frequency, 20);
  const lowpass = num(v.lowpass ?? old.lowpass, EQ_LIMITS.frequency, 16000);
  const lowGain = num(lowShelf.gain ?? v.low, EQ_LIMITS.gain, 0);
  const highGain = num(highShelf.gain ?? v.high, EQ_LIMITS.gain, 0);
  const low: EqBand = highpass > 20 && lowGain === 0
    ? { type: "lowcut", frequency: highpass, gain: 0, q: NEUTRAL_Q }
    : normalizeBand({ type: "lowshelf", frequency: lowShelf.frequency, gain: lowGain }, DEFAULT_BANDS[0]);
  const high: EqBand = lowpass < 16000 && highGain === 0
    ? { type: "highcut", frequency: lowpass, gain: 0, q: NEUTRAL_Q }
    : normalizeBand({ type: "highshelf", frequency: highShelf.frequency, gain: highGain }, DEFAULT_BANDS[2]);
  return { bands: [low, normalizeBand({ ...bell, type: "bell" }, DEFAULT_BANDS[1]), high] };
}

/** Coefficients of one band (Audio EQ Cookbook). `b` feeds forward, `a` feeds back; `a[0]` is 1. */
export function bandCoefficients(band: EqBand, sampleRate: number): { b: [number, number, number]; a: [number, number, number] } {
  const w0 = (2 * Math.PI * Math.min(band.frequency, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * band.q);
  const A = Math.pow(10, band.gain / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (band.type === "lowcut" || band.type === "highcut") {
    const k = band.type === "lowcut" ? 1 + cos : 1 - cos;
    b0 = k / 2;
    b1 = band.type === "lowcut" ? -k : k;
    b2 = k / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (band.type === "bell") {
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  } else {
    const root = 2 * Math.sqrt(A) * alpha;
    const sign = band.type === "lowshelf" ? 1 : -1;
    b0 = A * (A + 1 - sign * (A - 1) * cos + root);
    b1 = sign * 2 * A * (A - 1 - sign * (A + 1) * cos);
    b2 = A * (A + 1 - sign * (A - 1) * cos - root);
    a0 = A + 1 + sign * (A - 1) * cos + root;
    a1 = -sign * 2 * (A - 1 + sign * (A + 1) * cos);
    a2 = A + 1 + sign * (A - 1) * cos - root;
  }
  return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] };
}

/** Magnitude in dB of one band at `hz`. */
export function bandDb(band: EqBand, hz: number, sampleRate = 48000): number {
  const { b, a } = bandCoefficients(band, sampleRate);
  const w = (2 * Math.PI * hz) / sampleRate;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const numerator = Math.hypot(b[0] + b[1] * c1 + b[2] * c2, b[1] * s1 + b[2] * s2);
  const denominator = Math.hypot(a[0] + a[1] * c1 + a[2] * c2, a[1] * s1 + a[2] * s2);
  return 20 * Math.log10(Math.max(1e-6, numerator / denominator));
}

/** Combined gain in dB of the whole equalizer at each frequency. This is the curve drawn on the graph. */
export function equalizerResponse(eq: Equalizer, frequencies: readonly number[], sampleRate = 48000): number[] {
  return frequencies.map((hz) => eq.bands.reduce((sum, band) => sum + bandDb(band, hz, sampleRate), 0));
}

/** `count` frequencies spread evenly by octave across the graph. */
export function graphFrequencies(count: number): number[] {
  const [min, max] = GRAPH_HZ;
  return Array.from({ length: count }, (_, i) => min * Math.pow(max / min, i / (count - 1)));
}

/** Horizontal position (0 to 1) of a frequency on the graph, and back. */
export function hzToX(hz: number): number {
  return Math.log(Math.max(GRAPH_HZ[0], Math.min(GRAPH_HZ[1], hz)) / GRAPH_HZ[0]) / Math.log(GRAPH_HZ[1] / GRAPH_HZ[0]);
}
export function xToHz(x: number): number {
  return GRAPH_HZ[0] * Math.pow(GRAPH_HZ[1] / GRAPH_HZ[0], Math.max(0, Math.min(1, x)));
}
/** Vertical position (0 top to 1 bottom) of a gain on the graph, and back. */
export function dbToY(db: number): number {
  return (GRAPH_DB[1] - Math.max(GRAPH_DB[0], Math.min(GRAPH_DB[1], db))) / (GRAPH_DB[1] - GRAPH_DB[0]);
}
export function yToDb(y: number): number {
  return GRAPH_DB[1] - Math.max(0, Math.min(1, y)) * (GRAPH_DB[1] - GRAPH_DB[0]);
}

/** Where a band's handle sits on the graph. Cuts have no gain, so their handles sit on the 0 dB line. */
export function handleOf(eq: Equalizer, index: number): { hz: number; db: number } {
  const band = eq.bands[index];
  return { hz: band.frequency, db: isCut(band.type) ? 0 : band.gain };
}

/** Changes one band, keeping every value inside its limits. */
export function updateBand(eq: Equalizer, index: number, patch: Partial<EqBand>): Equalizer {
  return normalizeEqualizer({ bands: eq.bands.map((band, i) => (i === index ? { ...band, ...patch } : band)) });
}

/** Moves one band's handle to a frequency and gain. Cuts keep their gain because they only move sideways. */
export function moveBand(eq: Equalizer, index: number, hz: number, db: number): Equalizer {
  return updateBand(eq, index, isCut(eq.bands[index].type) ? { frequency: hz } : { frequency: hz, gain: db });
}

/** Switches the kind of one band. A cut starts with a flat Q so it does not ring. */
export function setBandType(eq: Equalizer, index: number, type: BandType): Equalizer {
  const band = eq.bands[index];
  if (band.type === type) return eq;
  return updateBand(eq, index, { type, q: type === "bell" ? (band.type === "bell" ? band.q : 1) : NEUTRAL_Q });
}

const PEAK_FREQUENCIES = graphFrequencies(160);
/**
 * The loudest boost of the equalizer curve in dB, used to keep a boosted speaker from exceeding its volume.
 * It is read from the curve, so the bump of a narrow shelf or a resonant cut counts too.
 */
export function peakBoost(eq: Equalizer): number {
  const peak = Math.max(0, ...equalizerResponse(eq, PEAK_FREQUENCIES));
  return peak < 1e-6 ? 0 : peak;
}
