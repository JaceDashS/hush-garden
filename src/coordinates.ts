/** Rounds to two decimals, about 1 km, so the exact position never leaves the device. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
