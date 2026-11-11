/** Garden geometry: a square tile grid drawn in quarter view. Positions are in tile units. */

export interface Point {
  x: number;
  y: number;
}

/** Tiles per side of the garden. */
export const GARDEN_SIZE = 24;
/** On-screen size of one tile diamond in logical pixels. */
export const TILE_WIDTH = 72;
export const TILE_HEIGHT = 36;
/** Walking speed in tiles per second. */
export const WALK_SPEED = 3.2;
/** Closest distance a character keeps from the garden edge. */
const EDGE_MARGIN = 0.35;

/** Projects a garden position to quarter-view screen coordinates (origin at the top corner of the garden). */
export function toScreen(point: Point): Point {
  return { x: (point.x - point.y) * (TILE_WIDTH / 2), y: (point.x + point.y) * (TILE_HEIGHT / 2) };
}

/** Inverse of toScreen. */
export function toGarden(screen: Point): Point {
  const a = screen.x / (TILE_WIDTH / 2);
  const b = screen.y / (TILE_HEIGHT / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Keeps a position inside the garden. */
export function clampToGarden(point: Point): Point {
  const max = GARDEN_SIZE - EDGE_MARGIN;
  return { x: Math.min(max, Math.max(EDGE_MARGIN, point.x)), y: Math.min(max, Math.max(EDGE_MARGIN, point.y)) };
}

/**
 * Moves a character for `seconds`. `input` is a screen direction (x right, y down) from the keyboard or joystick,
 * with length up to 1; the character walks the matching way on screen, so "up" always goes up the screen.
 */
export function step(position: Point, input: Point, seconds: number): Point {
  const length = Math.hypot(input.x, input.y);
  if (length < 0.05 || seconds <= 0) return position;
  const garden = toGarden(input);
  const norm = Math.hypot(garden.x, garden.y);
  // Normalised so every screen direction moves at the same garden speed; a half-pushed joystick walks slower.
  const tiles = WALK_SPEED * Math.min(seconds, 0.1) * Math.min(1, length);
  return clampToGarden({ x: position.x + (garden.x / norm) * tiles, y: position.y + (garden.y / norm) * tiles });
}

/** Combines pressed arrow or WASD keys into a screen direction. */
export function keysToInput(keys: ReadonlySet<string>): Point {
  const has = (...names: string[]) => names.some((name) => keys.has(name));
  const x = (has("ArrowRight", "d", "D") ? 1 : 0) - (has("ArrowLeft", "a", "A") ? 1 : 0);
  const y = (has("ArrowDown", "s", "S") ? 1 : 0) - (has("ArrowUp", "w", "W") ? 1 : 0);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Joystick knob offset in pixels to a screen direction; inside the dead zone the character stands still. */
export function joystickToInput(dx: number, dy: number, radius: number): Point {
  const length = Math.hypot(dx, dy);
  if (length < radius * 0.15) return { x: 0, y: 0 };
  const scale = Math.min(1, length / radius) / length;
  return { x: dx * scale, y: dy * scale };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
