/**
 * Plans how a nature recording is played so the listener does not notice it repeating, and when heartbeat beats
 * fall. Pure functions: the audio engine turns the plans into scheduled sources and gain ramps.
 *
 * A recording is a set of chunks (CHUNK_SECONDS each). It is played as a chain of layers: each layer is a random
 * section of a random chunk, of random length, fading in while the one before fades out over the same time (an
 * equal-power crossfade, so the level never dips). Now and then a short extra layer is laid quietly on top, so the
 * number of overlapping sections changes too.
 */

/** Length of one chunk of a built recording, in seconds (see scripts/build-sounds.ts). */
export const CHUNK_SECONDS = 60;
/** Length of a chained layer, of its crossfade, and of an extra layer, in seconds. */
export const LAYER_SECONDS = [20, 45] as const;
export const FADE_SECONDS = [3, 9] as const;
export const EXTRA_SECONDS = [10, 25] as const;
/** Chance that a chained layer gets an extra layer on top, and how loud an extra layer is. */
export const EXTRA_CHANCE = 0.3;
export const EXTRA_PEAK = 0.5;

export interface Layer {
  /** When it starts, in seconds on the plan's clock. */
  start: number;
  chunk: number;
  /** Where in the chunk it starts, in seconds. */
  offset: number;
  length: number;
  fadeIn: number;
  fadeOut: number;
  /** Gain at full level: 1 for the chain, EXTRA_PEAK for an extra layer. */
  peak: number;
}

const between = (random: () => number, [low, high]: readonly [number, number]) => low + (high - low) * random();

function section(random: () => number, chunks: number, length: number): Pick<Layer, "chunk" | "offset"> {
  return { chunk: Math.min(chunks - 1, Math.floor(random() * chunks)), offset: random() * Math.max(0, CHUNK_SECONDS - length) };
}

/**
 * The next layers after `previous` (or the first ones when there is none): the next chained layer, which starts
 * when `previous` begins to fade out and fades in over the same time, and sometimes an extra layer during it.
 */
export function nextLayers(previous: Layer | null, chunks: number, random: () => number = Math.random): Layer[] {
  const length = between(random, LAYER_SECONDS);
  const fadeOut = Math.min(between(random, FADE_SECONDS), length / 3);
  const fadeIn = previous ? previous.fadeOut : between(random, FADE_SECONDS);
  const start = previous ? previous.start + previous.length - previous.fadeOut : 0;
  const chained: Layer = { start, ...section(random, chunks, length), length, fadeIn, fadeOut, peak: 1 };
  if (random() >= EXTRA_CHANCE) return [chained];
  const extraLength = between(random, EXTRA_SECONDS);
  const extraFade = Math.min(between(random, [3, 6]), extraLength / 3);
  const extra: Layer = { start: start + random() * Math.max(0, length - extraLength), ...section(random, chunks, extraLength), length: extraLength, fadeIn: extraFade, fadeOut: extraFade, peak: EXTRA_PEAK };
  return [chained, extra];
}

/**
 * Gain of a layer at `t` on the plan's clock: a quarter sine up, the peak, a quarter cosine down, so two layers
 * crossfading over the same time keep a constant power.
 */
export function layerGain(layer: Layer, t: number): number {
  const into = t - layer.start;
  if (into <= 0 || into >= layer.length) return 0;
  if (into < layer.fadeIn) return layer.peak * Math.sin((into / layer.fadeIn) * (Math.PI / 2));
  const left = layer.length - into;
  if (left < layer.fadeOut) return layer.peak * Math.sin((left / layer.fadeOut) * (Math.PI / 2));
  return layer.peak;
}

/** Points of a layer's gain curve for scheduling (setValueCurveAtTime takes evenly spaced values). */
export function fadeCurve(peak: number, rising: boolean, points = 32): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    curve[i] = peak * Math.sin((rising ? x : 1 - x) * (Math.PI / 2));
  }
  return curve;
}

/** How much a heartbeat's spacing wanders from beat to beat, as a share of the beat length. */
export const BEAT_JITTER = 0.03;

/** The time of the next beat after one at `last`, at `tempo` beats per minute, with a little natural wander. */
export function nextBeat(last: number, tempo: number, random: () => number = Math.random): number {
  const spacing = 60 / tempo;
  return last + spacing * (1 + (random() * 2 - 1) * BEAT_JITTER);
}
