/**
 * The garden objects of the nature sources. Each is drawn in the same 60 × 76 box as a speaker, standing on the
 * same point, so the scene, carrying and the make and discard animations treat them alike. Each object moves on
 * its own: moving parts are animated views laid over a still picture, and every loop starts at a random moment
 * so two equal objects do not move in step. `still` keeps an object in its resting pose (the sound picker).
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import type { NatureSource } from "../domain/sound";

const W = 60;
const H = 76;
const INK = "#4a4038";
const NATIVE = Platform.OS !== "web";

/** Colour of the sound waves each nature source sends out over the ground. */
export const NATURE_TINT: Record<NatureSource, string> = {
  rain: "#5b9fd6",
  stream: "#3fb0c9",
  waterfall: "#3a86cf",
  reeds: "#9aab45",
  airplane: "#8c9bb0",
  campfire: "#f07f2f",
  waves: "#2496bf",
  thunder: "#7a6cc0",
  cafe: "#9a6a43",
  windchime: "#d8a531",
  train: "#d5545a",
  heartbeat: "#e9728f",
};

/** A value that runs from 0 to 1 again and again, starting at a random moment. */
function useLoop(ms: number, still: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: NATIVE }));
    const timer = setTimeout(() => loop.start(), Math.random() * ms);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [ms, still, value]);
  return value;
}

/** A value that swings smoothly from 0 to 1 and back, starting at a random moment; 0.5 is the resting pose. */
function useSwing(ms: number, still: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (still) return;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: ms / 4, easing: ease, useNativeDriver: NATIVE }),
        Animated.timing(value, { toValue: 0, duration: ms / 2, easing: ease, useNativeDriver: NATIVE }),
        Animated.timing(value, { toValue: 0.5, duration: ms / 4, easing: ease, useNativeDriver: NATIVE }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), Math.random() * ms);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [ms, still, value]);
  return value;
}

const range = (value: Animated.Value, inputRange: number[], outputRange: number[]) => value.interpolate({ inputRange, outputRange });
const swing = (value: Animated.Value, from: number, to: number) => range(value, [0, 1], [from, to]);
const deg = (value: Animated.Value, amount: number) => value.interpolate({ inputRange: [0, 1], outputRange: [-amount + "deg", amount + "deg"] });

/** A part of a picture drawn in its own view at (x, y), so it can move; `origin` is the point it turns around. */
function Part({ x, y, w, h, style, origin, children }: { x: number; y: number; w: number; h: number; style?: object; origin?: string; children: React.ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x, top: y, width: w, height: h }, origin ? { transformOrigin: origin } : null, style]}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Shadow({ rx = 20 }: { rx?: number }) {
  return <Ellipse cx={30} cy={70} rx={rx} ry={5} fill="rgba(74,64,56,0.18)" />;
}

/** Two dot eyes and a smile, for the objects that have a face. */
function Face({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <G>
      <Circle cx={x - 4.5 * size} cy={y} r={1.7 * size} fill={INK} />
      <Circle cx={x + 4.5 * size} cy={y} r={1.7 * size} fill={INK} />
      <Path d={`M${x - 2.5 * size} ${y + 3 * size} q${2.5 * size} ${2.6 * size} ${5 * size} 0`} stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Ellipse cx={x - 7.5 * size} cy={y + 3 * size} rx={2} ry={1.3} fill="#ff9eb5" />
      <Ellipse cx={x + 7.5 * size} cy={y + 3 * size} rx={2} ry={1.3} fill="#ff9eb5" />
    </G>
  );
}

type ArtProps = { still: boolean; shadow: boolean };

function Rain({ still, shadow }: ArtProps) {
  const drops = [useLoop(1100, still), useLoop(1300, still), useLoop(1200, still)];
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={18} />}
        <Ellipse cx={30} cy={66} rx={16} ry={4} fill="#bfe1f5" stroke={INK} strokeWidth={1.5} />
        <Path d="M10 32 a9 9 0 0 1 4 -16 a12 12 0 0 1 22 -6 a10 10 0 0 1 14 12 a7 7 0 0 1 -2 10 z" fill="#eaf4fb" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Face x={30} y={21} size={0.9} />
      </Svg>
      {[17, 29, 41].map((x, index) => (
        <Part key={x} x={x - 3} y={34} w={6} h={9} style={{ opacity: range(drops[index], [0, 0.1, 0.8, 1], still ? [1, 1, 1, 1] : [0, 1, 1, 0]), transform: [{ translateY: swing(drops[index], index * 6 - 2, 24) }] }}>
          <Path d="M3 0 q3 5 3 6 a3 3 0 0 1 -6 0 q0 -1 3 -6 z" fill={NATURE_TINT.rain} />
        </Part>
      ))}
    </>
  );
}

function Stream({ still, shadow }: ArtProps) {
  const flow = useLoop(1400, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={24} />}
        <Path d="M4 60 q8 -20 26 -18 q20 2 26 18 q-26 12 -52 0 z" fill="#a5dd9b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M8 58 q10 -10 22 -9 q14 1 22 9 q-22 7 -44 0 z" fill="#8fd0e8" stroke={INK} strokeWidth={1.5} />
        <Ellipse cx={10} cy={52} rx={6} ry={4} fill="#c9c2b8" stroke={INK} strokeWidth={1.8} />
        <Ellipse cx={50} cy={53} rx={5} ry={3.5} fill="#c9c2b8" stroke={INK} strokeWidth={1.8} />
        <Ellipse cx={44} cy={44} rx={4} ry={3} fill="#d8d2c8" stroke={INK} strokeWidth={1.5} />
        <Path d="M22 40 v-10 M22 32 l-4 -4 M22 34 l4 -3" stroke="#5fb893" strokeWidth={2} strokeLinecap="round" />
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 12, top: 50, width: 36, height: 10, overflow: "hidden", borderRadius: 5 }}>
        <Part x={0} y={0} w={72} h={10} style={{ transform: [{ translateX: swing(flow, -24, 0) }] }}>
          {[0, 24, 48].map((x) => (
            <Path key={x} d={`M${x + 2} 6 q4 -4 8 0 q4 4 8 0`} stroke="#ffffff" strokeWidth={1.8} fill="none" strokeLinecap="round" />
          ))}
        </Part>
      </View>
    </>
  );
}

function Waterfall({ still, shadow }: ArtProps) {
  const fall = useLoop(700, still);
  const foam = useSwing(1600, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={22} />}
        <Path d="M8 58 q-2 -40 10 -50 q12 -6 24 0 q12 10 10 50 z" fill="#b9b2a8" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M14 22 q4 -4 8 0 M38 30 q4 -4 8 0" stroke="#8fd6b4" strokeWidth={3} strokeLinecap="round" />
        <Rect x={22} y={10} width={16} height={52} rx={3} fill="#9fd8f0" stroke={INK} strokeWidth={1.8} />
        <Ellipse cx={30} cy={64} rx={20} ry={6} fill="#8fd0e8" stroke={INK} strokeWidth={1.8} />
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 23, top: 11, width: 14, height: 50, overflow: "hidden" }}>
        <Part x={0} y={0} w={14} h={100} style={{ transform: [{ translateY: swing(fall, -50, 0) }] }}>
          {[0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5].map((y, index) => (
            <Line key={y} x1={index % 2 ? 4 : 9} y1={y} x2={index % 2 ? 4 : 9} y2={y + 7} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
          ))}
        </Part>
      </View>
      <Part x={16} y={56} w={28} h={12} origin="14px 8px" style={{ transform: [{ scale: swing(foam, 0.85, 1.12) }] }}>
        <Circle cx={7} cy={7} r={3.5} fill="#ffffff" />
        <Circle cx={14} cy={5} r={4.5} fill="#ffffff" />
        <Circle cx={21} cy={7} r={3.5} fill="#ffffff" />
      </Part>
    </>
  );
}

function Reeds({ still, shadow }: ArtProps) {
  const sways = [useSwing(2600, still), useSwing(3100, still), useSwing(2800, still), useSwing(3400, still), useSwing(2900, still)];
  const reeds = [
    { x: 14, top: 18, tilt: -8 },
    { x: 22, top: 6, tilt: -3 },
    { x: 30, top: 12, tilt: 2 },
    { x: 38, top: 4, tilt: 5 },
    { x: 46, top: 20, tilt: 9 },
  ];
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={20} />}
        <Ellipse cx={30} cy={66} rx={18} ry={5} fill="#8fbf6a" stroke={INK} strokeWidth={1.8} />
      </Svg>
      {reeds.map((reed, index) => (
        <Part key={reed.x} x={reed.x - 6} y={reed.top} w={12} h={66 - reed.top} origin={`6px ${66 - reed.top}px`} style={{ transform: [{ rotate: deg(sways[index], 7 + index) }, { rotate: reed.tilt + "deg" }] }}>
          <Line x1={6} y1={66 - reed.top} x2={6} y2={4} stroke="#7f9a3a" strokeWidth={2.2} strokeLinecap="round" />
          {index % 2 === 0 ? <Rect x={3.5} y={4} width={5} height={13} rx={2.5} fill="#a8774b" stroke={INK} strokeWidth={1.3} /> : <Path d="M6 4 q-5 10 0 22" stroke="#b8c76a" strokeWidth={3} fill="none" strokeLinecap="round" />}
        </Part>
      ))}
    </>
  );
}

function Airplane({ still, shadow }: ArtProps) {
  const bob = useSwing(2400, still);
  const prop = useLoop(160, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Ellipse cx={30} cy={70} rx={14} ry={3.5} fill="rgba(74,64,56,0.14)" />}
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: [{ translateY: swing(bob, 3, -3) }, { rotate: deg(bob, 3) }] }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Path d="M12 30 l-6 -12 h6 l8 10 z" fill="#ffb3c6" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M24 40 l-10 14 h8 l12 -14 z" fill="#ffb3c6" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Rect x={6} y={28} width={44} height={16} rx={8} fill="#f4f1ea" stroke={INK} strokeWidth={2.5} />
          <Path d="M8 38 h40" stroke="#5b9fd6" strokeWidth={3} />
          <Circle cx={20} cy={33} r={2} fill="#9fd8f0" stroke={INK} strokeWidth={1} />
          <Circle cx={27} cy={33} r={2} fill="#9fd8f0" stroke={INK} strokeWidth={1} />
          <Circle cx={34} cy={33} r={2} fill="#9fd8f0" stroke={INK} strokeWidth={1} />
          <Path d="M24 30 l-8 -12 h8 l10 12 z" fill="#ffb3c6" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={51} cy={36} r={2.5} fill={INK} />
        </Svg>
        <Part x={50} y={26} w={6} h={20} origin="3px 10px" style={{ transform: [{ scaleY: range(prop, [0, 0.5, 1], still ? [1, 1, 1] : [1, 0.15, 1]) }] }}>
          <Rect x={1.5} y={0} width={3} height={20} rx={1.5} fill="#8a8077" />
        </Part>
      </Animated.View>
    </>
  );
}

function Campfire({ still, shadow }: ArtProps) {
  const outer = useSwing(900, still);
  const inner = useSwing(650, still);
  const sparks = [useLoop(1700, still), useLoop(2300, still)];
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={22} />}
        <Ellipse cx={30} cy={64} rx={20} ry={6} fill="rgba(240,127,47,0.18)" />
        <Rect x={10} y={56} width={40} height={8} rx={4} fill="#a8774b" stroke={INK} strokeWidth={2} transform="rotate(-14 30 60)" />
        <Rect x={10} y={56} width={40} height={8} rx={4} fill="#b78f68" stroke={INK} strokeWidth={2} transform="rotate(14 30 60)" />
        {[8, 18, 42, 52].map((x) => (
          <Ellipse key={x} cx={x} cy={x === 18 || x === 42 ? 68 : 64} rx={5} ry={3.5} fill="#c9c2b8" stroke={INK} strokeWidth={1.5} />
        ))}
      </Svg>
      <Part x={14} y={16} w={32} h={44} origin="16px 44px" style={{ transform: [{ scaleY: swing(outer, 0.9, 1.08) }, { scaleX: swing(outer, 1.04, 0.95) }] }}>
        <Path d="M16 2 q6 12 12 18 q8 12 -2 22 h-20 q-10 -10 -2 -22 q6 -6 12 -18 z" fill="#ff9e4a" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </Part>
      <Part x={20} y={30} w={20} h={30} origin="10px 30px" style={{ transform: [{ scaleY: swing(inner, 0.85, 1.1) }] }}>
        <Path d="M10 2 q4 8 7 12 q5 8 -1 14 h-12 q-6 -6 -1 -14 q3 -4 7 -12 z" fill="#ffd36b" />
        <Circle cx={7} cy={20} r={1.4} fill={INK} />
        <Circle cx={13} cy={20} r={1.4} fill={INK} />
      </Part>
      {sparks.map((spark, index) => (
        <Part key={index} x={index ? 36 : 22} y={8} w={4} h={4} style={{ opacity: range(spark, [0, 0.2, 0.7, 1], still ? [0, 0, 0, 0] : [0, 1, 0.6, 0]), transform: [{ translateY: swing(spark, 10, -6) }, { translateX: swing(spark, 0, index ? 4 : -4) }] }}>
          <Circle cx={2} cy={2} r={1.8} fill="#ffd36b" />
        </Part>
      ))}
    </>
  );
}

function Waves({ still, shadow }: ArtProps) {
  const rise = useSwing(3200, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={24} />}
        <Path d="M4 62 q26 -10 52 0 q-26 12 -52 0 z" fill="#f3dfb0" stroke={INK} strokeWidth={1.8} />
        <Path d="M6 60 q24 -8 48 0 q-24 6 -48 0 z" fill="#7cc6e0" stroke={INK} strokeWidth={1.5} />
      </Svg>
      <Part x={6} y={20} w={48} h={42} origin="24px 42px" style={{ transform: [{ scaleY: swing(rise, 0.78, 1.06) }, { translateX: swing(rise, -2, 2) }] }}>
        <Path d="M2 40 q4 -26 24 -34 q16 -6 20 6 q-10 -4 -14 4 q8 2 10 10 q4 10 -2 14 z" fill={NATURE_TINT.waves} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
        <Path d="M30 16 q-2 -6 6 -8 q8 0 8 6" stroke="#ffffff" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Face x={18} y={28} size={0.8} />
      </Part>
    </>
  );
}

function Thunder({ still, shadow }: ArtProps) {
  const flash = useLoop(3400, still);
  const lit = range(flash, [0, 0.55, 0.57, 0.62, 0.66, 0.7, 0.76, 1], still ? [1, 1, 1, 1, 1, 1, 1, 1] : [0, 0, 1, 0.2, 1, 1, 0, 0]);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={16} />}
        <Path d="M8 34 a9 9 0 0 1 4 -16 a12 12 0 0 1 22 -6 a10 10 0 0 1 16 12 a7 7 0 0 1 -2 10 z" fill="#8a86a8" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Circle cx={25} cy={23} r={1.8} fill={INK} />
        <Circle cx={35} cy={23} r={1.8} fill={INK} />
        <Path d="M27 28 h6" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      <Part x={18} y={30} w={24} h={38} style={{ opacity: lit }}>
        <Path d="M14 2 l-10 18 h8 l-6 16 l16 -22 h-9 l7 -12 z" fill="#ffd84d" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      </Part>
    </>
  );
}

function Cafe({ still, shadow }: ArtProps) {
  const steam = [useLoop(2200, still), useLoop(2600, still)];
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={20} />}
        <Ellipse cx={30} cy={64} rx={22} ry={5} fill="#fffaf2" stroke={INK} strokeWidth={2} />
        <Path d="M44 42 a7 7 0 0 1 0 14" stroke={INK} strokeWidth={4.5} fill="none" />
        <Path d="M44 42 a7 7 0 0 1 0 14" stroke="#fffaf2" strokeWidth={2} fill="none" />
        <Path d="M12 34 h34 v14 q0 14 -17 14 q-17 0 -17 -14 z" fill="#fffaf2" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Ellipse cx={29} cy={34} rx={17} ry={4} fill={NATURE_TINT.cafe} stroke={INK} strokeWidth={2} />
        <Face x={29} y={47} size={0.9} />
      </Svg>
      {steam.map((wisp, index) => (
        <Part key={index} x={index ? 30 : 18} y={8} w={12} h={24} style={{ opacity: range(wisp, [0, 0.3, 1], still ? [0.7, 0.7, 0.7] : [0, 0.8, 0]), transform: [{ translateY: swing(wisp, 6, -6) }] }}>
          <Path d="M6 22 q-5 -5 0 -10 q5 -5 0 -10" stroke="#c9c2b8" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </Part>
      ))}
    </>
  );
}

function Windchime({ still, shadow }: ArtProps) {
  const sway = useSwing(2300, still);
  const strip = useSwing(1700, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={16} />}
        <Rect x={44} y={6} width={5} height={62} rx={2.5} fill="#b78f68" stroke={INK} strokeWidth={1.8} />
        <Rect x={14} y={5} width={35} height={5} rx={2.5} fill="#b78f68" stroke={INK} strokeWidth={1.8} />
        <Ellipse cx={46.5} cy={68} rx={7} ry={2.5} fill="#a8774b" stroke={INK} strokeWidth={1.5} />
      </Svg>
      <Part x={8} y={10} w={36} h={58} origin="18px 0px" style={{ transform: [{ rotate: deg(sway, 9) }] }}>
        <Line x1={18} y1={0} x2={18} y2={6} stroke={INK} strokeWidth={1.5} />
        <Path d="M6 16 q12 -14 24 0 z" fill="#ffd36b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        {[9, 15, 21, 27].map((x, index) => (
          <Rect key={x} x={x - 1.5} y={17} width={3} height={14 + (index % 2) * 5} rx={1.5} fill="#e8e2d6" stroke={INK} strokeWidth={1} />
        ))}
        <Line x1={18} y1={16} x2={18} y2={36} stroke={INK} strokeWidth={1} />
        <Circle cx={18} cy={34} r={2.5} fill="#ff9eb5" stroke={INK} strokeWidth={1} />
        <Line x1={18} y1={36} x2={18} y2={40} stroke={INK} strokeWidth={1} />
      </Part>
      <Part x={20} y={48} w={12} h={18} origin="6px 0px" style={{ transform: [{ rotate: deg(strip, 18) }] }}>
        <Rect x={2} y={0} width={8} height={17} rx={1.5} fill="#ff9eb5" stroke={INK} strokeWidth={1.2} />
      </Part>
    </>
  );
}

function Train({ still, shadow }: ArtProps) {
  const rock = useLoop(600, still);
  const wheel = useLoop(900, still);
  const puffs = [useLoop(1800, still), useLoop(1800, still)];
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={24} />}
        <Path d="M2 66 h56" stroke="#8a8077" strokeWidth={3} strokeLinecap="round" />
        {[8, 20, 32, 44, 56].map((x) => (
          <Rect key={x} x={x - 3} y={64} width={6} height={4} rx={1} fill="#b78f68" />
        ))}
      </Svg>
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: [{ translateY: range(rock, [0, 0.15, 0.3, 0.45, 1], still ? [0, 0, 0, 0, 0] : [0, -1.5, 0, -1, 0]) }] }}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={8} y={26} width={18} height={30} rx={4} fill="#e9728f" stroke={INK} strokeWidth={2.5} />
          <Rect x={12} y={30} width={10} height={9} rx={2} fill="#9fd8f0" stroke={INK} strokeWidth={1.5} />
          <Rect x={6} y={22} width={22} height={6} rx={3} fill={INK} />
          <Rect x={24} y={38} width={28} height={18} rx={8} fill={NATURE_TINT.train} stroke={INK} strokeWidth={2.5} />
          <Rect x={40} y={26} width={7} height={13} rx={2} fill={INK} />
          <Circle cx={52} cy={47} r={3} fill="#ffd36b" stroke={INK} strokeWidth={1.5} />
          <Face x={36} y={45} size={0.75} />
        </Svg>
      </Animated.View>
      {[14, 30, 44].map((x) => (
        <Part key={x} x={x - 6} y={53} w={12} h={12} origin="6px 6px" style={{ transform: [{ rotate: wheel.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
          <Circle cx={6} cy={6} r={5} fill="#4a4038" />
          <Line x1={6} y1={2} x2={6} y2={10} stroke="#c9c2b8" strokeWidth={1.4} />
          <Line x1={2} y1={6} x2={10} y2={6} stroke="#c9c2b8" strokeWidth={1.4} />
        </Part>
      ))}
      {puffs.map((puff, index) => (
        <Part key={index} x={37} y={8} w={16} h={16} origin="8px 8px" style={{ opacity: range(puff, [0, 0.2, 1], still ? [index ? 0 : 0.8, index ? 0 : 0.8, index ? 0 : 0.8] : [0, 0.9, 0]), transform: [{ translateY: swing(puff, 12, -6) }, { translateX: swing(puff, 0, -6) }, { scale: swing(puff, 0.5, 1.2) }] }}>
          <Circle cx={8} cy={8} r={6} fill="#f4f1ea" stroke="#c9c2b8" strokeWidth={1.5} />
        </Part>
      ))}
    </>
  );
}

function Heartbeat({ still, shadow }: ArtProps) {
  const beat = useLoop(1000, still);
  return (
    <>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {shadow && <Shadow rx={18} />}
        <Path d="M18 68 q12 -8 24 0 z" fill="#ffd1dc" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
      <Part x={6} y={14} w={48} h={52} origin="24px 52px" style={{ transform: [{ scale: range(beat, [0, 0.1, 0.2, 0.3, 0.42, 1], still ? [1, 1, 1, 1, 1, 1] : [1, 1.12, 1, 1.07, 1, 1]) }] }}>
        <Path d="M24 50 q-22 -14 -22 -30 a11 11 0 0 1 22 -6 a11 11 0 0 1 22 6 q0 16 -22 30 z" fill={NATURE_TINT.heartbeat} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Ellipse cx={13} cy={14} rx={3} ry={5} fill="#ffffff" opacity={0.5} />
        <Face x={24} y={24} size={0.9} />
      </Part>
    </>
  );
}

const ARTS: Record<NatureSource, (props: ArtProps) => React.ReactElement> = {
  rain: Rain,
  stream: Stream,
  waterfall: Waterfall,
  reeds: Reeds,
  airplane: Airplane,
  campfire: Campfire,
  waves: Waves,
  thunder: Thunder,
  cafe: Cafe,
  windchime: Windchime,
  train: Train,
  heartbeat: Heartbeat,
};

/** The object of one nature source in the speaker's 60 × 76 box. `shadow` false leaves out its ground shadow. */
export const NatureArt = React.memo(function NatureArt({ source, shadow = true, still = false }: { source: NatureSource; shadow?: boolean; still?: boolean }) {
  const Art = ARTS[source];
  return (
    <View pointerEvents="none" style={{ width: W, height: H }}>
      <Art still={still} shadow={shadow} />
    </View>
  );
});
