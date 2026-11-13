/**
 * The safety net on the final output. react-native-audio-api has no compressor, so a wave shaper rounds off peaks
 * instead: quiet sound passes unchanged, and a sum that would pass 1 is bent smoothly below it instead of being cut.
 */

/** Below this level the output equals the input. */
export const LIMIT_KNEE = 0.7;
/** The shaper sees the input divided by this, so peaks up to this level are rounded rather than cut. */
export const LIMIT_RANGE = 4;

/** Leaves values up to the knee alone and bends the rest smoothly toward 1, never reaching it. */
export function softClip(value: number): number {
  const size = Math.abs(value);
  if (size <= LIMIT_KNEE) return value;
  const room = 1 - LIMIT_KNEE;
  return Math.sign(value) * (LIMIT_KNEE + room * Math.tanh((size - LIMIT_KNEE) / room));
}

/** The shaper curve for an input already divided by LIMIT_RANGE. */
export function limiterCurve(points = 8193): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = softClip(((i / (points - 1)) * 2 - 1) * LIMIT_RANGE);
  return curve;
}
