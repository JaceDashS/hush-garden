/** The ten characters, drawn in code. Every character is built from the same parts so one pose moves them all. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Polygon } from "react-native-svg";
import type { Stance } from "../domain/actions";
import { WALK_FRAME_MS, nextWalkFrame, poseFor, type CharacterKind, type Pose } from "../domain/characters";

export const CHARACTER_SIZE = { width: 56, height: 64 };

const INK = "#4a4038";
const BLUSH = "#ff9eb5";

interface Look {
  body: string;
  belly: string;
  ears: "long" | "point" | "round" | "none";
  /** Inner ear colour, or the ear colour itself for pandas. */
  ear?: string;
  earInner?: string;
  face: "plain" | "whiskers" | "muzzle" | "beak" | "snout" | "frog" | "patches";
  accent?: string;
}

const LOOKS: Record<CharacterKind, Look> = {
  bunny: { body: "#ffd1dc", belly: "#ffffff", ears: "long", earInner: "#ffffff", face: "plain" },
  cat: { body: "#ffd9a0", belly: "#fff6e6", ears: "point", earInner: "#ffb3c6", face: "whiskers" },
  bear: { body: "#d9b08c", belly: "#f3dfc8", ears: "round", earInner: "#f3dfc8", face: "muzzle" },
  frog: { body: "#b4e39a", belly: "#effbd9", ears: "none", face: "frog" },
  chick: { body: "#fff0a0", belly: "#fffbe0", ears: "none", face: "beak", accent: "#ffb347" },
  fox: { body: "#ffb27a", belly: "#ffffff", ears: "point", earInner: "#ffffff", face: "muzzle" },
  penguin: { body: "#8fa8c8", belly: "#ffffff", ears: "none", face: "beak", accent: "#ffb347" },
  pig: { body: "#ffc2cf", belly: "#ffe3ea", ears: "point", earInner: "#ff9eb5", face: "snout" },
  panda: { body: "#ffffff", belly: "#ffffff", ears: "round", ear: INK, face: "patches" },
  mouse: { body: "#d8d8e6", belly: "#f4f4fa", ears: "round", earInner: "#ffc2cf", face: "whiskers" },
};

function Ears({ look, sway }: { look: Look; sway: number }) {
  const fill = look.ear ?? look.body;
  if (look.ears === "long") {
    return (
      <G>
        <G transform={`rotate(${-18 + sway} 17 24)`}>
          <Ellipse cx={17} cy={11} rx={6} ry={11} fill={fill} stroke={INK} strokeWidth={2} />
          <Ellipse cx={17} cy={12} rx={2.5} ry={6.5} fill={look.earInner} />
        </G>
        <G transform={`rotate(${18 + sway} 39 24)`}>
          <Ellipse cx={39} cy={11} rx={6} ry={11} fill={fill} stroke={INK} strokeWidth={2} />
          <Ellipse cx={39} cy={12} rx={2.5} ry={6.5} fill={look.earInner} />
        </G>
      </G>
    );
  }
  if (look.ears === "point") {
    return (
      <G>
        <G transform={`rotate(${sway} 16 24)`}>
          <Polygon points="9,24 13,7 24,19" fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="13,20 14.5,12 19.5,18" fill={look.earInner} />
        </G>
        <G transform={`rotate(${sway} 40 24)`}>
          <Polygon points="47,24 43,7 32,19" fill={fill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Polygon points="43,20 41.5,12 36.5,18" fill={look.earInner} />
        </G>
      </G>
    );
  }
  if (look.ears === "round") {
    const big = look.earInner === "#ffc2cf";
    const r = big ? 9 : 7;
    return (
      <G>
        <G transform={`rotate(${sway} 14 20)`}>
          <Circle cx={13} cy={18} r={r} fill={fill} stroke={INK} strokeWidth={2} />
          {!!look.earInner && <Circle cx={13} cy={18} r={r - 4} fill={look.earInner} />}
        </G>
        <G transform={`rotate(${sway} 42 20)`}>
          <Circle cx={43} cy={18} r={r} fill={fill} stroke={INK} strokeWidth={2} />
          {!!look.earInner && <Circle cx={43} cy={18} r={r - 4} fill={look.earInner} />}
        </G>
      </G>
    );
  }
  return null;
}

function Face({ look }: { look: Look }) {
  const eyes = (
    <G>
      <Circle cx={22} cy={32} r={2.6} fill={INK} />
      <Circle cx={36} cy={32} r={2.6} fill={INK} />
      <Circle cx={22.8} cy={31.2} r={0.9} fill="#ffffff" />
      <Circle cx={36.8} cy={31.2} r={0.9} fill="#ffffff" />
    </G>
  );
  const blush = (
    <G>
      <Ellipse cx={17} cy={38} rx={3.2} ry={2} fill={BLUSH} opacity={0.8} />
      <Ellipse cx={41} cy={38} rx={3.2} ry={2} fill={BLUSH} opacity={0.8} />
    </G>
  );
  const smile = <Path d="M26.5 37 q2.5 3 5 0" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
  switch (look.face) {
    case "whiskers":
      return (
        <G>
          {eyes}
          {blush}
          <Path d="M27.5 35.5 l1.5 1.6 l1.5 -1.6 z" fill={BLUSH} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
          <Path d="M29 37.2 q-2 2.4 -4 0.6 M29 37.2 q2 2.4 4 0.6" stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <Path d="M13 34 h-6 M13 37 l-6 1.5 M45 34 h6 M45 37 l6 1.5" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        </G>
      );
    case "muzzle":
      return (
        <G>
          {eyes}
          {blush}
          <Ellipse cx={29} cy={38.5} rx={7} ry={5} fill={look.belly} />
          <Ellipse cx={29} cy={36.2} rx={2.4} ry={1.7} fill={INK} />
          <Path d="M26.5 39.5 q2.5 2.4 5 0" stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </G>
      );
    case "beak":
      return (
        <G>
          {eyes}
          {blush}
          <Polygon points="25,35.5 33,35.5 29,41" fill={look.accent} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        </G>
      );
    case "snout":
      return (
        <G>
          {eyes}
          {blush}
          <Ellipse cx={29} cy={38} rx={6} ry={4.3} fill={BLUSH} stroke={INK} strokeWidth={1.6} />
          <Circle cx={27} cy={38} r={1.1} fill={INK} />
          <Circle cx={31} cy={38} r={1.1} fill={INK} />
        </G>
      );
    case "frog":
      return (
        <G>
          <Circle cx={19} cy={21} r={7} fill={look.body} stroke={INK} strokeWidth={2} />
          <Circle cx={39} cy={21} r={7} fill={look.body} stroke={INK} strokeWidth={2} />
          <Circle cx={19} cy={21} r={3} fill={INK} />
          <Circle cx={39} cy={21} r={3} fill={INK} />
          <Circle cx={20} cy={20} r={1} fill="#ffffff" />
          <Circle cx={40} cy={20} r={1} fill="#ffffff" />
          {blush}
          <Path d="M20 36 q9 7 18 0" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </G>
      );
    case "patches":
      return (
        <G>
          <Ellipse cx={21.5} cy={32} rx={5} ry={6} fill={INK} transform="rotate(-14 21.5 32)" />
          <Ellipse cx={36.5} cy={32} rx={5} ry={6} fill={INK} transform="rotate(14 36.5 32)" />
          <Circle cx={22} cy={32} r={2} fill="#ffffff" />
          <Circle cx={36} cy={32} r={2} fill="#ffffff" />
          <Circle cx={22} cy={32} r={1} fill={INK} />
          <Circle cx={36} cy={32} r={1} fill={INK} />
          {blush}
          <Ellipse cx={29} cy={38} rx={2.2} ry={1.5} fill={INK} />
          <Path d="M26.5 40.5 q2.5 2 5 0" stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </G>
      );
    default:
      return (
        <G>
          {eyes}
          {blush}
          {smile}
        </G>
      );
  }
}

/** Where the feet touch the ground inside the character picture. */
export const CHARACTER_FEET = { x: 28, y: 59 };

/** One character picture in the given pose. `facing` -1 mirrors it to look left. `shadow` false leaves out the ground shadow. */
export const CharacterArt = React.memo(function CharacterArt({ kind, pose, facing = 1, shadow = true }: { kind: CharacterKind; pose: Pose; facing?: 1 | -1; shadow?: boolean }) {
  const open = pose.open ?? 0;
  const look = LOOKS[kind];
  const limb = kind === "panda" ? INK : look.body;
  return (
    <Svg width={CHARACTER_SIZE.width} height={CHARACTER_SIZE.height} viewBox="0 0 56 64" pointerEvents="none" style={{ overflow: "visible" }}>
      {shadow && <Ellipse cx={28} cy={59} rx={17 - Math.abs(pose.bob)} ry={4.5} fill="rgba(74,64,56,0.18)" />}
      <G transform={facing === -1 ? "translate(56 0) scale(-1 1)" : undefined}>
        <Ellipse cx={22 + pose.leftFoot.x} cy={56 + pose.leftFoot.y} rx={6} ry={4} fill={limb} stroke={INK} strokeWidth={2} />
        <Ellipse cx={35 + pose.rightFoot.x} cy={56 + pose.rightFoot.y} rx={6} ry={4} fill={limb} stroke={INK} strokeWidth={2} />
        <G transform={`translate(0 ${pose.bob})`}>
          <Ears look={look} sway={pose.sway} />
          {kind === "chick" && <Path d="M26 17 q2 -8 4 -1 q3 -6 3 2" stroke={INK} strokeWidth={2} fill={look.body} strokeLinecap="round" strokeLinejoin="round" />}
          {!pose.armsUp && (
            <G>
              <Ellipse cx={11} cy={42} rx={4} ry={6.5} fill={limb} stroke={INK} strokeWidth={2} transform={`rotate(${20 + pose.arm + open} 12 37)`} />
              <Ellipse cx={45} cy={42} rx={4} ry={6.5} fill={limb} stroke={INK} strokeWidth={2} transform={`rotate(${-20 + pose.arm - open} 44 37)`} />
            </G>
          )}
          <Ellipse cx={28} cy={36} rx={20} ry={19} fill={look.body} stroke={INK} strokeWidth={2.5} />
          <Ellipse cx={29} cy={44} rx={kind === "penguin" ? 14 : 11} ry={kind === "penguin" ? 11 : 8} fill={look.belly} opacity={0.9} />
          <Face look={look} />
          {pose.armsUp && (
            <G>
              <Ellipse cx={10} cy={21} rx={4} ry={9} fill={limb} stroke={INK} strokeWidth={2} transform="rotate(-14 10 28)" />
              <Ellipse cx={46} cy={21} rx={4} ry={9} fill={limb} stroke={INK} strokeWidth={2} transform="rotate(14 46 28)" />
            </G>
          )}
        </G>
      </G>
    </Svg>
  );
});

/**
 * A character that plays its walking cycle while `walking` is true and stands still otherwise.
 * Each character keeps its own timer, so characters step out of sync like a real crowd.
 * `carrying` raises both arms to hold a speaker overhead. `stance` displaces the whole body during an action:
 * it hops, leans, shifts and squashes around its feet while its shadow stays on the ground. `turn` -1 shows the
 * character turned around without changing the direction its `stance` moves in.
 */
export function Character({ kind, facing = 1, walking = false, carrying = false, stance, turn = 1 }: { kind: CharacterKind; facing?: 1 | -1; walking?: boolean; carrying?: boolean; stance?: Stance; turn?: 1 | -1 }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walking) return;
    setFrame(0);
    const timer = setInterval(() => setFrame(nextWalkFrame), WALK_FRAME_MS);
    return () => clearInterval(timer);
  }, [walking]);
  const base = poseFor(walking, frame, carrying);
  if (!stance) return <CharacterArt kind={kind} pose={base} facing={facing} />;
  const pose: Pose = { ...base, arm: walking || carrying ? base.arm : stance.arm, sway: base.sway + stance.sway, open: carrying ? 0 : stance.open };
  const look = (facing * turn) as 1 | -1;
  const squash = Math.max(0.3, stance.squash);
  const lift = Math.max(0, stance.hop);
  return (
    <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
      <View pointerEvents="none" style={{ position: "absolute", left: stance.shiftX * facing, top: 0, opacity: Math.max(0.25, 1 - lift / 160) }}>
        <Svg width={CHARACTER_SIZE.width} height={CHARACTER_SIZE.height} viewBox="0 0 56 64">
          <Ellipse cx={CHARACTER_FEET.x} cy={CHARACTER_FEET.y} rx={Math.max(6, 17 - lift / 12)} ry={4.5} fill="rgba(74,64,56,0.18)" />
        </Svg>
      </View>
      <View style={{ transformOrigin: CHARACTER_FEET.x + "px " + CHARACTER_FEET.y + "px", transform: [{ translateX: stance.shiftX * facing }, { translateY: -stance.hop }, { rotate: stance.tilt * look + "deg" }, { scaleX: 1 / Math.sqrt(squash) }, { scaleY: squash }] }}>
        <CharacterArt kind={kind} pose={pose} facing={look} shadow={false} />
      </View>
    </View>
  );
}
