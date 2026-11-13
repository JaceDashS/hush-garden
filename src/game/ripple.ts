/**
 * Timing of the sound waves a speaker sends across the ground. Each speaker sends its rings at its own uneven
 * pace, so the garden does not pulse in step.
 */

/** Seconds one ring takes to grow from the speaker to the edge of its reach. */
export const RIPPLE_SECONDS = 2.7;
/** Shortest and longest wait in seconds between two rings of one speaker. */
export const RIPPLE_INTERVAL = [0.6, 1.4] as const;
/** Rings one speaker needs at once: enough that a ring has finished before it is sent again. */
export const RIPPLE_POOL = Math.ceil(RIPPLE_SECONDS / RIPPLE_INTERVAL[0]);

/** The wait in seconds before a speaker sends its next ring. */
export function nextRippleInterval(random: () => number = Math.random): number {
  const [low, high] = RIPPLE_INTERVAL;
  return low + (high - low) * Math.min(1, Math.max(0, random()));
}

/** The wait in seconds before a speaker that has just appeared sends its first ring. */
export function firstRippleDelay(random: () => number = Math.random): number {
  return RIPPLE_INTERVAL[1] * Math.min(1, Math.max(0, random()));
}
