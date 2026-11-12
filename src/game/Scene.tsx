/** The quarter-view garden: ground, sound shadows, trees, speakers and characters, with the camera following the player. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import { CARRY, NEUTRAL, actionAt, type ActionName } from "../domain/actions";
import type { CharacterKind } from "../domain/characters";
import { loudnessAt, type NoiseColor, type Speaker } from "../domain/sound";
import { distance, joystickToInput, toScreen, type Point } from "../domain/world";
import { T, colors } from "../ui";
import { CHARACTER_FEET, CHARACTER_SIZE, Character } from "./characters";
import { FxView, PropView } from "./props";
import { GROUND_OFFSET_X, Ground, SPEAKER_SIZE, SoundShadow, SpeakerArt, TREES, TREE_SIZE, Tree, shadowSize } from "./sprites";

export interface Actor {
  id: string;
  x: number;
  y: number;
  /** Character name shown above the head. */
  name: string;
  /** Shown under the name: the place the player connected from. */
  label: string;
  /** Noise colour of the speaker the character holds overhead, if it carries one. */
  carrying?: NoiseColor;
  /** The action the character is playing: making, discarding or lifting a speaker of the given colour. */
  action?: { name: ActionName; startedAt: number; color: NoiseColor };
  bubble?: string;
  /** Which of the ten characters to draw. */
  kind: CharacterKind;
  facing?: 1 | -1;
  walking?: boolean;
}

/** Something pressable placed in the garden, such as the lift button beside a speaker. */
export interface Marker {
  id: string;
  x: number;
  y: number;
  /** Screen offset of the marker's centre from that garden position; y is down. */
  offsetX: number;
  offsetY: number;
  content: React.ReactNode;
}

const JOYSTICK_RADIUS = 52;
/** Room above a character for the speaker it holds. */
const CARRY_HEIGHT = 50;
const LABEL_HEIGHT = 34;
/** Time between two pictures of an action. */
const ACTION_FRAME_MS = 33;
const MARKER_WIDTH = 220;

const place = (point: Point) => {
  const screen = toScreen(point);
  return { left: screen.x + GROUND_OFFSET_X, top: screen.y };
};
const depth = (point: Point) => Math.round((point.x + point.y) * 10);

/** The character with whatever it holds. While an action plays, a timer redraws it frame by frame. */
function ActorBody({ actor }: { actor: Actor }) {
  const [now, setNow] = useState(() => Date.now());
  const action = actor.action;
  useEffect(() => {
    if (!action) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ACTION_FRAME_MS);
    return () => clearInterval(timer);
  }, [action]);
  const facing = actor.facing ?? 1;
  const moment = action ? actionAt(actor.kind, action.name, now - action.startedAt) : null;
  if (!moment) {
    return (
      <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
        <Character kind={actor.kind} facing={facing} walking={actor.walking} carrying={!!actor.carrying} />
        {!!actor.carrying && <PropView prop={CARRY} form="speaker" color={actor.carrying} facing={facing} origin={CHARACTER_FEET} />}
      </View>
    );
  }
  return (
    <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
      <Character kind={actor.kind} facing={facing} turn={moment.turn} walking={moment.walk} carrying={moment.arms === "up"} stance={moment.stance ?? NEUTRAL} />
      <PropView prop={moment.prop} form={moment.form} color={action!.color} facing={facing} origin={CHARACTER_FEET} />
      {moment.effects.map((effect, index) => (
        <FxView key={effect.kind + index + effect.x} kind={effect.kind} x={effect.x} y={effect.y} progress={effect.progress} facing={facing} origin={CHARACTER_FEET} />
      ))}
    </View>
  );
}

function ActorView({ actor }: { actor: Actor }) {
  const at = place(actor);
  const headroom = actor.carrying || actor.action ? CARRY_HEIGHT : 0;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: at.left - 90, top: at.top - CHARACTER_SIZE.height - 44 - LABEL_HEIGHT - headroom, width: 180, alignItems: "center", zIndex: depth(actor) }}>
      <View style={{ height: 40, justifyContent: "flex-end", alignItems: "center" }}>
        {!!actor.bubble && (
          <View style={{ maxWidth: 180, backgroundColor: colors.white, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2 }}>
            <T size={12} lines={2}>{actor.bubble}</T>
          </View>
        )}
      </View>
      <View style={{ height: LABEL_HEIGHT, marginBottom: 2 + headroom, backgroundColor: "rgba(255,250,242,0.88)", borderRadius: 10, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" }}>
        <T size={11.5} weight="800" lines={1}>{actor.name}</T>
        <T size={9.5} weight="600" tone="muted" lines={1}>{actor.label}</T>
      </View>
      <ActorBody actor={actor} />
    </View>
  );
}

const ActorMemo = React.memo(ActorView, (a, b) => a.actor.x === b.actor.x && a.actor.y === b.actor.y && a.actor.bubble === b.actor.bubble && a.actor.label === b.actor.label && a.actor.facing === b.actor.facing && a.actor.walking === b.actor.walking && a.actor.kind === b.actor.kind && a.actor.name === b.actor.name && a.actor.carrying === b.actor.carrying && a.actor.action === b.actor.action);

/**
 * `onInput` receives the joystick direction while a finger or the mouse is held on the garden, and zero on release.
 * `carriedId` is the speaker a character holds: it is drawn in that character's hands, not on the ground, while
 * its sound shadow follows the position it has in `speakers`. `markers` are pressable things placed in the garden.
 */
export function Scene({ me, actors, speakers, carriedId, markers, onInput }: { me: Point; actors: readonly Actor[]; speakers: readonly Speaker[]; carriedId?: string | null; markers?: readonly Marker[]; onInput: (input: Point) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const latest = useRef({ onInput });
  latest.current = { onInput };
  const touch = useRef({ x: 0, y: 0 });

  const responder = useMemo(() => {
    const finish = () => {
      setStick(null);
      latest.current.onInput({ x: 0, y: 0 });
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { pageX, pageY } = event.nativeEvent;
        root.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
        });
        touch.current = { x: pageX, y: pageY };
        setStick({ x: pageX - origin.current.x, y: pageY - origin.current.y, dx: 0, dy: 0 });
      },
      onPanResponderMove: (event) => {
        const dx = event.nativeEvent.pageX - touch.current.x;
        const dy = event.nativeEvent.pageY - touch.current.y;
        const length = Math.hypot(dx, dy) || 1;
        const clamp = Math.min(1, JOYSTICK_RADIUS / length);
        setStick((current) => (current ? { ...current, dx: dx * clamp, dy: dy * clamp } : current));
        latest.current.onInput(joystickToInput(dx, dy, JOYSTICK_RADIUS));
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    });
  }, []);

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
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, transform: [{ translateX: size.width / 2 - camera.left }, { translateY: size.height / 2 - camera.top }] }}>
        <Ground />
        {speakers.map((speaker) => {
          const at = place(speaker);
          const shade = shadowSize(speaker.sound);
          return (
            <View key={"shade" + speaker.id} testID={"shadow-" + speaker.id} pointerEvents="none" style={{ position: "absolute", left: at.left - shade.width / 2, top: at.top - shade.height / 2 }}>
              <SoundShadow id={speaker.id} sound={speaker.sound} />
            </View>
          );
        })}
        {TREES.map((tree) => {
          const at = place(tree);
          return (
            <View key={"t" + tree.x + "-" + tree.y} pointerEvents="none" style={{ position: "absolute", left: at.left - TREE_SIZE.width / 2, top: at.top - TREE_SIZE.height + 8, zIndex: depth(tree) }}>
              <Tree kind={tree.kind} />
            </View>
          );
        })}
        {speakers.map((speaker) => {
          if (speaker.id === carriedId) return null;
          const at = place(speaker);
          const playing = loudnessAt(distance(me, speaker), speaker.sound) > 0.01;
          return (
            <View key={speaker.id} pointerEvents="none" style={{ position: "absolute", left: at.left - 70, top: at.top - SPEAKER_SIZE.height - 14, width: 140, alignItems: "center", zIndex: depth(speaker) }}>
              <View style={{ height: 18, backgroundColor: "rgba(255,250,242,0.88)", borderRadius: 9, paddingHorizontal: 7, justifyContent: "center" }}>
                <T size={10.5} weight="700" tone="muted" lines={1}>{speaker.name}</T>
              </View>
              <SpeakerArt color={speaker.sound.noise.color} playing={playing} />
            </View>
          );
        })}
        {actors.map((actor) => <ActorMemo key={actor.id} actor={actor} />)}
        {(markers ?? []).map((marker) => {
          const at = place(marker);
          return (
            <View key={marker.id} pointerEvents="box-none" style={{ position: "absolute", left: at.left + marker.offsetX - MARKER_WIDTH / 2, top: at.top + marker.offsetY - 22, width: MARKER_WIDTH, height: 44, alignItems: "center", justifyContent: "center", zIndex: 100000 }}>
              {marker.content}
            </View>
          );
        })}
      </View>
      {stick && (
        <View pointerEvents="none" style={{ position: "absolute", left: stick.x - JOYSTICK_RADIUS, top: stick.y - JOYSTICK_RADIUS, width: JOYSTICK_RADIUS * 2, height: JOYSTICK_RADIUS * 2, borderRadius: JOYSTICK_RADIUS, backgroundColor: "rgba(255,250,242,0.55)", borderWidth: 3, borderColor: "rgba(74,64,56,0.35)" }}>
          <View style={{ position: "absolute", left: JOYSTICK_RADIUS - 3 - 22 + stick.dx, top: JOYSTICK_RADIUS - 3 - 22 + stick.dy, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.accentDeep }} />
        </View>
      )}
    </View>
  );
}
