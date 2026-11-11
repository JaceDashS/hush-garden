/** The quarter-view garden: ground, trees, speakers and characters, with the camera following the player. */
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import { gainAt, type Speaker } from "../domain/sound";
import { TILE_HEIGHT, TILE_WIDTH, distance, joystickToInput, toGarden, toScreen, type Point } from "../domain/world";
import { T, colors } from "../ui";
import type { CharacterKind } from "../domain/characters";
import { CHARACTER_SIZE, Character } from "./characters";
import { GROUND_OFFSET_X, Ground, SPEAKER_SIZE, SpeakerArt, TREES, TREE_SIZE, Tree } from "./sprites";

export interface Actor {
  id: string;
  x: number;
  y: number;
  /** Shown above the head: the place the player connected from. */
  label: string;
  bubble?: string;
  /** Which of the ten characters to draw. */
  kind: CharacterKind;
  facing?: 1 | -1;
  walking?: boolean;
}

const JOYSTICK_RADIUS = 52;
const TAP_PIXELS = 8;
const TAP_MS = 350;

const place = (point: Point) => {
  const screen = toScreen(point);
  return { left: screen.x + GROUND_OFFSET_X, top: screen.y };
};
const depth = (point: Point) => Math.round((point.x + point.y) * 10);

function Range({ speaker, strong }: { speaker: Speaker; strong: boolean }) {
  const rx = (speaker.sound.radius * TILE_WIDTH) / Math.SQRT2;
  const ry = (speaker.sound.radius * TILE_HEIGHT) / Math.SQRT2;
  const at = place(speaker);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: at.left - rx, top: at.top - ry }}>
      <Svg width={rx * 2} height={ry * 2}>
        <Ellipse cx={rx} cy={ry} rx={rx - 2} ry={ry - 2} fill={strong ? "rgba(255,158,181,0.16)" : "rgba(143,214,180,0.12)"} stroke={strong ? colors.accentDeep : colors.mintDeep} strokeWidth={2} strokeDasharray="8 8" />
      </Svg>
    </View>
  );
}

function ActorView({ actor }: { actor: Actor }) {
  const at = place(actor);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: at.left - 90, top: at.top - CHARACTER_SIZE.height - 62, width: 180, alignItems: "center", zIndex: depth(actor) }}>
      <View style={{ height: 40, justifyContent: "flex-end", alignItems: "center" }}>
        {!!actor.bubble && (
          <View style={{ maxWidth: 180, backgroundColor: colors.white, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2 }}>
            <T size={12} lines={2}>{actor.bubble}</T>
          </View>
        )}
      </View>
      <View style={{ height: 20, marginBottom: 2, backgroundColor: "rgba(255,250,242,0.88)", borderRadius: 10, paddingHorizontal: 8, justifyContent: "center" }}>
        <T size={11} weight="700" lines={1}>{actor.label}</T>
      </View>
      <Character kind={actor.kind} facing={actor.facing} walking={actor.walking} />
    </View>
  );
}

const ActorMemo = React.memo(ActorView, (a, b) => a.actor.x === b.actor.x && a.actor.y === b.actor.y && a.actor.bubble === b.actor.bubble && a.actor.label === b.actor.label && a.actor.facing === b.actor.facing && a.actor.walking === b.actor.walking && a.actor.kind === b.actor.kind);

/**
 * `onInput` receives the joystick direction while a finger or the mouse is held, and zero on release.
 * `onTap` receives the garden position of a short touch that did not move, and the speaker under it if any.
 */
export function Scene({ me, actors, speakers, selectedId, showRanges, onInput, onTap }: { me: Point; actors: readonly Actor[]; speakers: readonly Speaker[]; selectedId?: string | null; showRanges?: boolean; onInput: (input: Point) => void; onTap?: (point: Point, speakerId: string | null) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const latest = useRef({ me, size, speakers, onInput, onTap });
  latest.current = { me, size, speakers, onInput, onTap };
  const touch = useRef({ x: 0, y: 0, at: 0, moved: 0 });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { pageX, pageY } = event.nativeEvent;
          root.current?.measureInWindow((x, y) => {
            origin.current = { x, y };
          });
          touch.current = { x: pageX, y: pageY, at: Date.now(), moved: 0 };
          setStick({ x: pageX - origin.current.x, y: pageY - origin.current.y, dx: 0, dy: 0 });
        },
        onPanResponderMove: (event) => {
          const dx = event.nativeEvent.pageX - touch.current.x;
          const dy = event.nativeEvent.pageY - touch.current.y;
          touch.current.moved = Math.max(touch.current.moved, Math.hypot(dx, dy));
          const length = Math.hypot(dx, dy) || 1;
          const clamp = Math.min(1, JOYSTICK_RADIUS / length);
          setStick((current) => (current ? { ...current, dx: dx * clamp, dy: dy * clamp } : current));
          latest.current.onInput(joystickToInput(dx, dy, JOYSTICK_RADIUS));
        },
        onPanResponderRelease: () => finish(true),
        onPanResponderTerminate: () => finish(false),
      }),
    // The handlers read the latest props through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function finish(completed: boolean) {
    const state = latest.current;
    setStick(null);
    state.onInput({ x: 0, y: 0 });
    const t = touch.current;
    if (!completed || !state.onTap || t.moved > TAP_PIXELS || Date.now() - t.at > TAP_MS) return;
    const camera = place(state.me);
    const local = { x: t.x - origin.current.x - state.size.width / 2 + camera.left - GROUND_OFFSET_X, y: t.y - origin.current.y - state.size.height / 2 + camera.top };
    // A tap on a speaker's picture counts as that speaker, even though its ground point is at its feet.
    const hit = state.speakers
      .filter((speaker) => {
        const foot = toScreen(speaker);
        return Math.abs(local.x - foot.x) <= SPEAKER_SIZE.width / 2 + 6 && local.y >= foot.y - SPEAKER_SIZE.height - 6 && local.y <= foot.y + 12;
      })
      .sort((a, b) => depth(b) - depth(a))[0];
    state.onTap(toGarden(local), hit?.id ?? null);
  }

  const camera = place(me);
  return (
    <View
      ref={root}
      testID="garden-scene"
      onLayout={(event) => {
        setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
        root.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
        });
      }}
      style={{ flex: 1, overflow: "hidden", backgroundColor: colors.sky }}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, transform: [{ translateX: size.width / 2 - camera.left }, { translateY: size.height / 2 - camera.top }] }}>
        <Ground />
        {speakers.map((speaker) => (showRanges || speaker.id === selectedId ? <Range key={"r" + speaker.id} speaker={speaker} strong={speaker.id === selectedId} /> : null))}
        {TREES.map((tree) => {
          const at = place(tree);
          return (
            <View key={"t" + tree.x + "-" + tree.y} pointerEvents="none" style={{ position: "absolute", left: at.left - TREE_SIZE.width / 2, top: at.top - TREE_SIZE.height + 8, zIndex: depth(tree) }}>
              <Tree kind={tree.kind} />
            </View>
          );
        })}
        {speakers.map((speaker) => {
          const at = place(speaker);
          const playing = gainAt(distance(me, speaker), speaker.sound.radius) * speaker.sound.volume > 0.01;
          return (
            <View key={speaker.id} pointerEvents="none" style={{ position: "absolute", left: at.left - 70, top: at.top - SPEAKER_SIZE.height - 14, width: 140, alignItems: "center", zIndex: depth(speaker) }}>
              <View style={{ height: 18, backgroundColor: "rgba(255,250,242,0.88)", borderRadius: 9, paddingHorizontal: 7, justifyContent: "center" }}>
                <T size={10.5} weight="700" tone="muted" lines={1}>{speaker.name}</T>
              </View>
              <SpeakerArt color={speaker.sound.noise.color} selected={speaker.id === selectedId} playing={playing} />
            </View>
          );
        })}
        {actors.map((actor) => <ActorMemo key={actor.id} actor={actor} />)}
      </View>
      {stick && (
        <View pointerEvents="none" style={{ position: "absolute", left: stick.x - JOYSTICK_RADIUS, top: stick.y - JOYSTICK_RADIUS, width: JOYSTICK_RADIUS * 2, height: JOYSTICK_RADIUS * 2, borderRadius: JOYSTICK_RADIUS, backgroundColor: "rgba(255,250,242,0.55)", borderWidth: 3, borderColor: "rgba(74,64,56,0.35)" }}>
          <View style={{ position: "absolute", left: JOYSTICK_RADIUS - 3 - 22 + stick.dx, top: JOYSTICK_RADIUS - 3 - 22 + stick.dy, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.accentDeep }} />
        </View>
      )}
    </View>
  );
}
