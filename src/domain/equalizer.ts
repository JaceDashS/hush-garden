/**
 * The speaker equalizer: one curve made of five bands. From left to right: a low cut, a low shelf, a bell,
 * a high shelf and a high cut. The response is computed with the same filter formulas the audio engine uses,
 * so the drawn curve matches what is heard.
 */

export interface Equalizer {
  /** Low cut: sound below this frequency (Hz) is removed. */
  highpass: number;
  lowShelf: { frequency: number; gain: number };
  bell: { frequency: number; gain: number; q: number };
  highShelf: { frequency: number; gain: number };
  /** High cut: sound above this frequency (Hz) is removed. Never below `highpass`. */
  lowpass: number;
}

export type BandId = "highpass" | "lowShelf" | "bell" | "highShelf" | "lowpass";
export const BAND_IDS: readonly BandId[] = ["highpass", "lowShelf", "bell", "highShelf", "lowpass"];

export const EQ_LIMITS = {
  gain: [-24, 12],
  highpass: [10, 2000],
  lowShelfFrequency: [40, 1000],
  bellFrequency: [100, 8000],
  bellQ: [0.3, 8],
  highShelfFrequency: [1000, 12000],
  lowpass: [200, 20000],
} as const;

/** Frequency range of the graph. */
export const GRAPH_HZ = [20, 20000] as const;
/** Gain range of the graph in dB. */
export const GRAPH_DB = [-30, 18] as const;

function num(value: unknown, [min, max]: readonly [number, number], fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

export function flatEqualizer(): Equalizer {
  return { highpass: 20, lowShelf: { frequency: 200, gain: 0 }, bell: { frequency: 1000, gain: 0, q: 1 }, highShelf: { frequency: 4000, gain: 0 }, lowpass: 16000 };
}

/**
 * Turns any stored or received value into a valid equalizer. `legacyFilter` is the separate filter object of
 * the first sound format (`eq.low`, `eq.mid`, `eq.high` plus `filter.highpass` and `filter.lowpass`), which is
 * still read so older saved gardens keep their sound.
 */
export function normalizeEqualizer(value: unknown, legacyFilter?: unknown): Equalizer {
  const flat = flatEqualizer();
  const v = record(value);
  const old = record(legacyFilter);
  const lowShelf = record(v.lowShelf);
  const bell = record(v.bell ?? v.mid);
  const highShelf = record(v.highShelf);
  const highpass = num(v.highpass ?? old.highpass, EQ_LIMITS.highpass, flat.highpass);
  return {
    highpass,
    lowShelf: { frequency: num(lowShelf.frequency, EQ_LIMITS.lowShelfFrequency, flat.lowShelf.frequency), gain: num(lowShelf.gain ?? v.low, EQ_LIMITS.gain, 0) },
    bell: { frequency: num(bell.frequency, EQ_LIMITS.bellFrequency, flat.bell.frequency), gain: num(bell.gain, EQ_LIMITS.gain, 0), q: num(bell.q, EQ_LIMITS.bellQ, 1) },
    highShelf: { frequency: num(highShelf.frequency, EQ_LIMITS.highShelfFrequency, flat.highShelf.frequency), gain: num(highShelf.gain ?? v.high, EQ_LIMITS.gain, 0) },
    // The high cut never drops below the low cut, which would silence the speaker.
    lowpass: Math.max(highpass, num(v.lowpass ?? old.lowpass, EQ_LIMITS.lowpass, flat.lowpass)),
  };
}

type Kind = "highpass" | "lowpass" | "lowshelf" | "highshelf" | "peaking";

/** Magnitude in dB of one second-order filter at `hz` (Audio EQ Cookbook formulas, as used by Web Audio). */
function bandDb(kind: Kind, frequency: number, gain: number, q: number, hz: number, sampleRate: number): number {
  const w0 = (2 * Math.PI * Math.min(frequency, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const A = Math.pow(10, gain / 40);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (kind === "highpass" || kind === "lowpass") {
    const alpha = sin / (2 * Math.SQRT1_2);
    const k = kind === "highpass" ? 1 + cos : 1 - cos;
    b0 = k / 2;
    b1 = kind === "highpass" ? -k : k;
    b2 = k / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (kind === "peaking") {
    const alpha = sin / (2 * q);
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  } else {
    const alpha = (sin / 2) * Math.SQRT2;
    const root = 2 * Math.sqrt(A) * alpha;
    const sign = kind === "lowshelf" ? 1 : -1;
    b0 = A * (A + 1 - sign * (A - 1) * cos + root);
    b1 = sign * 2 * A * (A - 1 - sign * (A + 1) * cos);
    b2 = A * (A + 1 - sign * (A - 1) * cos - root);
    a0 = A + 1 + sign * (A - 1) * cos + root;
    a1 = -sign * 2 * (A - 1 + sign * (A + 1) * cos);
    a2 = A + 1 + sign * (A - 1) * cos - root;
  }
  const w = (2 * Math.PI * hz) / sampleRate;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const numerator = Math.hypot(b0 + b1 * c1 + b2 * c2, b1 * s1 + b2 * s2);
  const denominator = Math.hypot(a0 + a1 * c1 + a2 * c2, a1 * s1 + a2 * s2);
  return 20 * Math.log10(Math.max(1e-6, numerator / denominator));
}

/** Combined gain in dB of the whole equalizer at each frequency. This is the curve drawn on the graph. */
export function equalizerResponse(eq: Equalizer, frequencies: readonly number[], sampleRate = 48000): number[] {
  return frequencies.map(
    (hz) =>
      bandDb("highpass", eq.highpass, 0, 0, hz, sampleRate) +
      bandDb("lowshelf", eq.lowShelf.frequency, eq.lowShelf.gain, 0, hz, sampleRate) +
      bandDb("peaking", eq.bell.frequency, eq.bell.gain, eq.bell.q, hz, sampleRate) +
      bandDb("highshelf", eq.highShelf.frequency, eq.highShelf.gain, 0, hz, sampleRate) +
      bandDb("lowpass", eq.lowpass, 0, 0, hz, sampleRate),
  );
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

/** Where a band's handle sits on the graph. The cut bands have no gain, so their handles sit on the 0 dB line. */
export function handleOf(eq: Equalizer, band: BandId): { hz: number; db: number } {
  switch (band) {
    case "highpass":
      return { hz: eq.highpass, db: 0 };
    case "lowpass":
      return { hz: eq.lowpass, db: 0 };
    default:
      return { hz: eq[band].frequency, db: eq[band].gain };
  }
}

/** Moves one band's handle to a frequency and gain, keeping every value inside its limits. */
export function moveBand(eq: Equalizer, band: BandId, hz: number, db: number): Equalizer {
  switch (band) {
    case "highpass":
      return normalizeEqualizer({ ...eq, highpass: Math.min(hz, eq.lowpass) });
    case "lowpass":
      return normalizeEqualizer({ ...eq, lowpass: Math.max(hz, eq.highpass) });
    default:
      return normalizeEqualizer({ ...eq, [band]: { ...eq[band], frequency: hz, gain: db } });
  }
}

/** The loudest boost of the equalizer in dB, used to keep a boosted speaker from exceeding its volume. */
export function peakBoost(eq: Equalizer): number {
  return Math.max(0, eq.lowShelf.gain, eq.bell.gain, eq.highShelf.gain);
}
