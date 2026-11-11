/** Vector artwork: ground tiles, characters, speakers and garden decorations. All drawn in code, no image files. */
import React from "react";
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";
import { GARDEN_SIZE, TILE_HEIGHT, TILE_WIDTH, toScreen } from "../domain/world";

/** Screen size of the whole garden; x is shifted so the left corner starts at 0. */
export const GROUND_WIDTH = GARDEN_SIZE * TILE_WIDTH;
export const GROUND_HEIGHT = GARDEN_SIZE * TILE_HEIGHT;
export const GROUND_OFFSET_X = GROUND_WIDTH / 2;
/** Height of the soil edge drawn under the garden. */
const SOIL = 26;

const GRASS = ["#bfe8b0", "#b3e2a4"];
const PATH = "#f3e3c3";

/** Deterministic pseudo-random number per tile, so decorations stay in place between renders. */
export function tileNoise(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

const isPath = (x: number, y: number) => Math.abs(x - y) <= 0 || (x + y === GARDEN_SIZE - 1 && Math.abs(x - y) < 9);

function diamond(x: number, y: number): string {
  const c = toScreen({ x: x + 0.5, y: y + 0.5 });
  const cx = c.x + GROUND_OFFSET_X;
  const w = TILE_WIDTH / 2;
  const h = TILE_HEIGHT / 2;
  return `${cx},${c.y - h} ${cx + w},${c.y} ${cx},${c.y + h} ${cx - w},${c.y}`;
}

/** The static ground. Rendered once. */
export const Ground = React.memo(function Ground() {
  const tiles: React.ReactNode[] = [];
  for (let y = 0; y < GARDEN_SIZE; y++) {
    for (let x = 0; x < GARDEN_SIZE; x++) {
      tiles.push(<Polygon key={x + "-" + y} points={diamond(x, y)} fill={isPath(x, y) ? PATH : GRASS[(x + y) % 2]} />);
      const n = tileNoise(x, y);
      if (!isPath(x, y) && n > 0.86) {
        const c = toScreen({ x: x + 0.5, y: y + 0.5 });
        const petal = n > 0.95 ? "#ff9eb5" : n > 0.9 ? "#fff3a8" : "#ffffff";
        tiles.push(
          <G key={"f" + x + "-" + y}>
            <Circle cx={c.x + GROUND_OFFSET_X - 3} cy={c.y} r={3} fill={petal} />
            <Circle cx={c.x + GROUND_OFFSET_X + 3} cy={c.y} r={3} fill={petal} />
            <Circle cx={c.x + GROUND_OFFSET_X} cy={c.y - 3} r={3} fill={petal} />
            <Circle cx={c.x + GROUND_OFFSET_X} cy={c.y + 3} r={3} fill={petal} />
            <Circle cx={c.x + GROUND_OFFSET_X} cy={c.y} r={2} fill="#ffc94d" />
          </G>,
        );
      }
    }
  }
  const mid = GROUND_WIDTH / 2;
  const half = GROUND_HEIGHT / 2;
  return (
    <Svg width={GROUND_WIDTH} height={GROUND_HEIGHT + SOIL} pointerEvents="none">
      <Polygon points={`0,${half} ${mid},${GROUND_HEIGHT} ${mid},${GROUND_HEIGHT + SOIL} 0,${half + SOIL}`} fill="#c9a27a" />
      <Polygon points={`${GROUND_WIDTH},${half} ${mid},${GROUND_HEIGHT} ${mid},${GROUND_HEIGHT + SOIL} ${GROUND_WIDTH},${half + SOIL}`} fill="#b78f68" />
      {tiles}
    </Svg>
  );
});

export const SPEAKER_SIZE = { width: 60, height: 76 };

const SPEAKER_TINT = { brown: "#d9a877", pink: "#ffb3c6", white: "#f4f1ea" } as const;

/** The one kind of speaker: a smiling cabinet on little feet, tinted by its noise colour. */
export const SpeakerArt = React.memo(function SpeakerArt({ color, selected, playing }: { color: keyof typeof SPEAKER_TINT; selected?: boolean; playing?: boolean }) {
  const tint = SPEAKER_TINT[color];
  return (
    <Svg width={SPEAKER_SIZE.width} height={SPEAKER_SIZE.height} viewBox="0 0 60 76" pointerEvents="none">
      <Ellipse cx={30} cy={70} rx={20} ry={5} fill="rgba(74,64,56,0.18)" />
      {playing && (
        <G opacity={0.9}>
          <Path d="M8 14 q-6 8 0 16" stroke="#8fd6b4" strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M52 14 q6 8 0 16" stroke="#8fd6b4" strokeWidth={3} fill="none" strokeLinecap="round" />
        </G>
      )}
      <Rect x={17} y={64} width={7} height={6} rx={3} fill="#4a4038" />
      <Rect x={36} y={64} width={7} height={6} rx={3} fill="#4a4038" />
      <Rect x={12} y={8} width={36} height={58} rx={11} fill={tint} stroke={selected ? "#e9728f" : "#4a4038"} strokeWidth={selected ? 4 : 2.5} />
      <Circle cx={30} cy={24} r={7.5} fill="#fffaf2" stroke="#4a4038" strokeWidth={2} />
      <Circle cx={30} cy={24} r={3} fill="#4a4038" />
      <Circle cx={30} cy={47} r={12} fill="#fffaf2" stroke="#4a4038" strokeWidth={2} />
      <Circle cx={25.5} cy={45} r={1.8} fill="#4a4038" />
      <Circle cx={34.5} cy={45} r={1.8} fill="#4a4038" />
      <Path d="M27 50 q3 3 6 0" stroke="#4a4038" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Ellipse cx={22.5} cy={49} rx={2.2} ry={1.4} fill="#ff9eb5" />
      <Ellipse cx={37.5} cy={49} rx={2.2} ry={1.4} fill="#ff9eb5" />
    </Svg>
  );
});

export const TREE_SIZE = { width: 72, height: 96 };

export const Tree = React.memo(function Tree({ kind }: { kind: number }) {
  const leaf = ["#8fd6b4", "#a5dd9b", "#ffc9d6"][kind % 3];
  return (
    <Svg width={TREE_SIZE.width} height={TREE_SIZE.height} viewBox="0 0 72 96" pointerEvents="none">
      <Ellipse cx={36} cy={90} rx={20} ry={5} fill="rgba(74,64,56,0.18)" />
      <Rect x={31} y={58} width={10} height={32} rx={4} fill="#b78f68" stroke="#4a4038" strokeWidth={2} />
      <Circle cx={36} cy={36} r={28} fill={leaf} stroke="#4a4038" strokeWidth={2.5} />
      <Circle cx={26} cy={28} r={7} fill="#ffffff" opacity={0.35} />
      {kind % 3 === 2 && (
        <G>
          <Circle cx={24} cy={44} r={3} fill="#ffffff" />
          <Circle cx={46} cy={30} r={3} fill="#ffffff" />
          <Circle cx={40} cy={50} r={3} fill="#ffffff" />
        </G>
      )}
    </Svg>
  );
});

/** Trees stand on fixed tiles around the garden edge so walking space stays open. */
export const TREES: readonly { x: number; y: number; kind: number }[] = (() => {
  const trees: { x: number; y: number; kind: number }[] = [];
  for (let i = 1; i < GARDEN_SIZE; i += 3) {
    trees.push({ x: i + 0.5, y: 0.6, kind: i });
    trees.push({ x: 0.6, y: i + 0.5, kind: i + 1 });
  }
  return trees;
})();
