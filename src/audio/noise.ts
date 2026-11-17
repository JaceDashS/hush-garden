import type { NoiseColor } from "../domain/sound";

/** Fills one loop of noise. Brown noise has its drift removed so the loop point is silent. */
export function fillNoise(color: NoiseColor, data: Float32Array, random: () => number = Math.random): void {
  const n = data.length;
  if (color === "white") {
    for (let i = 0; i < n; i++) data[i] = (random() * 2 - 1) * 0.5;
    return;
  }
  if (color === "pink") {
    // Paul Kellet's filter: -3 dB per octave.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const white = random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return;
  }
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
    data[i] = last;
  }
  const drift = data[n - 1] - data[0];
  let peak = 0;
  for (let i = 0; i < n; i++) {
    data[i] -= (drift * i) / (n - 1);
    peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = peak > 0 ? 0.6 / peak : 1;
  for (let i = 0; i < n; i++) data[i] *= scale;
}

export const NOISE_CHUNK_SECONDS = 5;
export const NOISE_CROSSFADE_SECONDS = 0.4;

export interface NoiseState {
  last: number;
  b0: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;
  b5: number;
  b6: number;
}

export function createNoiseState(): NoiseState {
  return { last: 0, b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 };
}

/**
 * Fills an independent random noise chunk while carrying filter state across chunks and applying
 * an equal-power fade-in / fade-out so overlapping chunks never comb-filter, dip, or click.
 */
export function fillNoiseChunk(
  color: NoiseColor,
  data: Float32Array,
  state: NoiseState,
  sampleRate: number,
  fadeIn: boolean,
  random: () => number = Math.random,
): void {
  const n = data.length;
  if (color === "white") {
    for (let i = 0; i < n; i++) data[i] = (random() * 2 - 1) * 0.5;
  } else if (color === "pink") {
    let { b0, b1, b2, b3, b4, b5, b6 } = state;
    for (let i = 0; i < n; i++) {
      const white = random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    state.b0 = b0;
    state.b1 = b1;
    state.b2 = b2;
    state.b3 = b3;
    state.b4 = b4;
    state.b5 = b5;
    state.b6 = b6;
  } else {
    let last = state.last;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
      data[i] = Math.max(-0.95, Math.min(0.95, last * 2.5));
    }
    state.last = last;
  }

  const fadeSamples = Math.min(Math.floor(n / 2), Math.floor(sampleRate * NOISE_CROSSFADE_SECONDS));
  if (fadeSamples <= 0) return;
  if (fadeIn) {
    for (let i = 0; i < fadeSamples; i++) {
      data[i] *= Math.sin((Math.PI * 0.5 * i) / fadeSamples);
    }
  }
  const outStart = n - fadeSamples;
  for (let i = 0; i < fadeSamples; i++) {
    data[outStart + i] *= Math.cos((Math.PI * 0.5 * i) / fadeSamples);
  }
}

/**
 * Where in a noise loop a new voice starts, in seconds. Voices of one colour share a loop, so each starts at a
 * random point: otherwise two of them play the same samples, which add up to clipping or, when slightly apart,
 * a metallic comb sound.
 */
export function loopOffset(seconds: number, random: () => number = Math.random): number {
  const offset = (random() * seconds) % seconds;
  return offset < 0 ? offset + seconds : offset;
}
