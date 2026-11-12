/** What a character handles during an action: the thing in its hands in its current form, and one-shot effects. */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";
import type { FxKind, PropForm, PropState } from "../domain/actions";
import type { NoiseColor } from "../domain/sound";
import { SPEAKER_SIZE, SpeakerArt } from "./sprites";

const INK = "#4a4038";
/** The point of the prop picture that stands on the ground. */
const FOOT = { x: SPEAKER_SIZE.width / 2, y: 70 };

function EggArt() {
  return (
    <Svg width={SPEAKER_SIZE.width} height={SPEAKER_SIZE.height} viewBox="0 0 60 76" pointerEvents="none">
      <Ellipse cx={30} cy={44} rx={19} ry={25} fill="#fffaf2" stroke={INK} strokeWidth={2.5} />
      <Ellipse cx={23} cy={33} rx={4} ry={7} fill="#ffffff" opacity={0.8} />
      <Circle cx={36} cy={52} r={3} fill="#ffe08a" />
      <Circle cx={25} cy={56} r={2.2} fill="#ffc2cf" />
    </Svg>
  );
}

function YarnArt() {
  return (
    <Svg width={SPEAKER_SIZE.width} height={SPEAKER_SIZE.height} viewBox="0 0 60 76" pointerEvents="none">
      <Circle cx={30} cy={46} r={23} fill="#ff9eb5" stroke={INK} strokeWidth={2.5} />
      <Path d="M11 40 q19 -16 38 2 M9 50 q21 -14 42 2 M16 62 q14 -22 30 -34 M30 23 q12 20 6 44" stroke="#e9728f" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Path d="M48 62 q8 6 4 10" stroke="#e9728f" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function LeafArt() {
  return (
    <Svg width={SPEAKER_SIZE.width} height={SPEAKER_SIZE.height} viewBox="0 0 60 76" pointerEvents="none">
      <Path d="M30 70 q-26 -22 0 -52 q26 30 0 52 z" fill="#8fd6b4" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M30 66 v-40 M30 52 l-8 -8 M30 44 l8 -8" stroke="#5fb893" strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The prop at its place for one moment of an action. `origin` is where the character's feet are inside the
 * parent view; `facing` mirrors sideways offsets and rotation.
 */
export function PropView({ prop, form, color, facing, origin }: { prop: PropState; form: PropForm; color: NoiseColor; facing: 1 | -1; origin: { x: number; y: number } }) {
  if (prop.opacity <= 0.01 || prop.scale <= 0.01) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: origin.x + prop.x * facing - FOOT.x, top: origin.y - prop.y - FOOT.y, opacity: Math.min(1, prop.opacity), transformOrigin: `${FOOT.x}px ${FOOT.y}px`, transform: [{ scaleX: prop.scale }, { scaleY: prop.scale * prop.squash }] }}>
      <View style={{ transform: [{ rotate: `${prop.spin * facing}deg` }] }}>
        {form === "egg" ? <EggArt /> : form === "yarn" ? <YarnArt /> : form === "leaf" ? <LeafArt /> : <SpeakerArt color={color} shadow={false} />}
      </View>
    </View>
  );
}

const FX_SIZE = 90;
/** Directions the particles of an effect fly in: sideways and upward share of the distance. */
const BURST = [[-1, 0.5], [-0.45, 1], [0.45, 1], [1, 0.5], [0, 0.75]] as const;

/** A short burst of particles. `progress` runs from 0 to 1. */
export function FxView({ kind, x, y, progress, facing, origin }: { kind: FxKind; x: number; y: number; progress: number; facing: 1 | -1; origin: { x: number; y: number } }) {
  const half = FX_SIZE / 2;
  const fade = 1 - progress;
  const reach = 8 + progress * 30;
  let parts: React.ReactNode;
  if (kind === "puff") {
    parts = BURST.map(([dx, dy], index) => <Circle key={index} cx={half + dx * reach} cy={half - dy * reach * 0.6} r={5 + progress * 7} fill="#fffaf2" stroke="rgba(74,64,56,0.25)" strokeWidth={1} />);
  } else if (kind === "dirt") {
    parts = BURST.map(([dx, dy], index) => <Circle key={index} cx={half + dx * reach * 0.8} cy={half - dy * reach * (1.4 - progress)} r={3.2 - progress} fill={index % 2 ? "#b78f68" : "#8d6a48"} />);
  } else if (kind === "crumbs") {
    parts = BURST.map(([dx, dy], index) => <Rect key={index} x={half + dx * reach * 0.7 - 2} y={half - dy * 10 + progress * progress * 34 - 2} width={4} height={4} rx={1} fill={index % 2 ? "#d9a877" : "#fffaf2"} stroke={INK} strokeWidth={0.6} />);
  } else if (kind === "leaves") {
    parts = BURST.map(([dx, dy], index) => (
      <G key={index} transform={`translate(${half + dx * reach} ${half - dy * reach * 0.5 + progress * 14}) rotate(${index * 70 + progress * 200})`}>
        <Path d="M0 6 q-7 -6 0 -13 q7 7 0 13 z" fill={index % 2 ? "#8fd6b4" : "#a5dd9b"} stroke={INK} strokeWidth={0.8} />
      </G>
    ));
  } else if (kind === "crack") {
    parts = <Path d={`M${half - 16} ${half} l6 -7 l5 8 l6 -9 l5 9 l6 -6`} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  } else {
    parts = BURST.slice(0, 4).map(([dx, dy], index) => (
      <G key={index} transform={`translate(${half + dx * reach} ${half - dy * reach}) scale(${0.6 + progress * 0.8})`}>
        <Path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#ffe08a" stroke="#e0a800" strokeWidth={0.8} />
      </G>
    ));
  }
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: origin.x + x * facing - half, top: origin.y - y - half, opacity: Math.max(0, Math.min(1, fade * 1.6)) }}>
      <Svg width={FX_SIZE} height={FX_SIZE}>{parts}</Svg>
    </View>
  );
}
