/** The quarter-view garden: ground, sound shadows, trees, speakers and characters, with the camera following the player. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, View } from "react-native";
import { CARRY, NEUTRAL, actionAt, actionDuration, actionKindOf, type ActionMoment, type ActionName, type GroundSpot } from "../domain/actions";
import type { CharacterKind } from "../domain/characters";
import { CHAT_RANGE } from "../domain/chat";
import { defaultSpeakerName } from "../domain/garden";
import { lookOf, loudnessAt, type SourceLook, type Speaker } from "../domain/sound";
import { TILE_HEIGHT, TILE_WIDTH, distance, joystickToInput, nextZoom, toScreen, type Point } from "../domain/world";
import { useT } from "../i18n";
import { T, colors } from "../ui";
import { CHARACTER_FEET, CHARACTER_SIZE, Character } from "./characters";
import { ImageCharacter, SheetLoading, useSheet } from "./imageCharacter";
import { FxView, PropView } from "./props";
import { GROUND_OFFSET_X, Ground, SPEAKER_SIZE, SoundShadow, SourceArt, TREES, TREE_SIZE, Tree, shadowSize } from "./sprites";

export interface Actor {
  id: string;
  x: number;
  y: number;
  /** Character name shown above the head. */
  name: string;
  /** Shown under the name: the place the player connected from. */
  label: string;
  /** Noise colour of the speaker the character holds overhead, if it carries one. */
  carrying?: SourceLook;
  /** The action the character is playing: making, discarding or lifting a speaker of the given colour. */
  action?: { name: ActionName; startedAt: number; look: SourceLook; ground?: GroundSpot };
  bubble?: string;
  /** Which of the ten characters to draw. */
  kind: CharacterKind;
  /** An approved character image drawn instead of `kind`, by its id. */
  custom?: string;
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

export interface ChatRipple {
  id: string;
  x: number;
  y: number;
  color: string;
}

const CHAT_RIPPLE_W = CHAT_RANGE * TILE_WIDTH * Math.SQRT2;
const CHAT_RIPPLE_H = CHAT_RANGE * TILE_HEIGHT * Math.SQRT2;

function ChatRippleView({ ripple }: { ripple: ChatRipple }) {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const anims = rings.map((ring, index) =>
      Animated.sequence([
        Animated.delay(index * 180),
        Animated.timing(ring, { toValue: 1, duration: 1350, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    const group = Animated.parallel(anims);
    group.start();
    return () => group.stop();
  }, [rings]);
  const at = place(ripple);
  const border = Math.max(3, CHAT_RIPPLE_W * 0.018);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: at.left - CHAT_RIPPLE_W / 2, top: at.top - CHAT_RIPPLE_H / 2, width: CHAT_RIPPLE_W, height: CHAT_RIPPLE_H }}>
      {rings.map((ring, index) => {
        const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.06, 1] });
        const opacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.85, 0] });
        return (
          <Animated.View
            key={index}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: (CHAT_RIPPLE_H - CHAT_RIPPLE_W) / 2,
              width: CHAT_RIPPLE_W,
              height: CHAT_RIPPLE_W,
              borderRadius: CHAT_RIPPLE_W / 2,
              borderWidth: border,
              borderColor: ripple.color,
              backgroundColor: ripple.color + "1f",
              opacity,
              transform: [{ scaleY: CHAT_RIPPLE_H / CHAT_RIPPLE_W }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

const JOYSTICK_RADIUS = 52;
/** Room above a character for the speaker it holds. */
const CARRY_HEIGHT = 72;
/**
 * Screen gap between a character's feet and the foot point of a speaker standing at the same garden spot: the
 * standing speaker art sits 5 px lower than the character's feet.
 */
const SPEAKER_BELOW_FEET = 5;

/**
 * Where a speaker standing at `spot` is for a character at `at` facing `facing`, in the prop coordinates of an
 * action. A lift starting there, or a put down ending there, lines up with the speaker drawn on the ground.
 */
export function groundSpotFor(at: Point, spot: Point, facing: 1 | -1): GroundSpot {
  const from = toScreen(at);
  const to = toScreen(spot);
  return { x: (to.x - from.x) * facing, y: -(to.y - from.y) - SPEAKER_BELOW_FEET };
}
const LABEL_HEIGHT = 34;
/** Time between two pictures of an action. */
const ACTION_FRAME_MS = 33;
const MARKER_WIDTH = 220;

const place = (point: Point) => {
  const screen = toScreen(point);
  return { left: screen.x + GROUND_OFFSET_X, top: screen.y };
};
const depth = (point: Point) => Math.round((point.x + point.y) * 10);

/** The character with whatever it holds; `moment` is the frame of the action being played, if any. */
function ActorBody({ actor, moment, progress, sheet }: { actor: Actor; moment: ActionMoment | null; progress: number; sheet: ReturnType<typeof useSheet> }) {
  const action = actor.action;
  const facing = actor.facing ?? 1;
  if (!moment) {
    return (
      <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
        {actor.custom ? <ImageCharacter id={actor.custom} sheet={sheet} facing={facing} walking={actor.walking} carrying={!!actor.carrying} /> : <Character kind={actor.kind} facing={facing} walking={actor.walking} carrying={!!actor.carrying} />}
        {!!actor.carrying && <PropView prop={CARRY} form="speaker" look={actor.carrying} facing={facing} origin={CHARACTER_FEET} />}
      </View>
    );
  }
  return (
    <View style={{ width: CHARACTER_SIZE.width, height: CHARACTER_SIZE.height }}>
      {actor.custom ? (
        <ImageCharacter id={actor.custom} sheet={sheet} facing={facing} action={{ name: action!.name, progress }} />
      ) : (
        <Character kind={actor.kind} facing={facing} turn={moment.turn} walking={moment.walk} carrying={moment.arms === "up"} stance={moment.stance ?? NEUTRAL} />
      )}
      <PropView prop={moment.prop} form={moment.form} look={action!.look} facing={facing} origin={CHARACTER_FEET} />
      {moment.effects.map((effect, index) => (
        <FxView key={effect.kind + index + effect.x} kind={effect.kind} x={effect.x} y={effect.y} progress={effect.progress} facing={facing} origin={CHARACTER_FEET} />
      ))}
    </View>
  );
}

/** While an action plays, a timer redraws the character frame by frame. */
function ActorView({ actor }: { actor: Actor }) {
  const [now, setNow] = useState(() => Date.now());
  const action = actor.action;
  useEffect(() => {
    if (!action) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ACTION_FRAME_MS);
    return () => clearInterval(timer);
  }, [action]);
  const sheet = useSheet(actor.custom);
  const kind = actionKindOf(actor.kind, actor.custom);
  const moment = action ? actionAt(kind, action.name, now - action.startedAt, action.ground) : null;
  const length = action ? actionDuration(kind, action.name === "putDown" ? "lift" : action.name) : 0;
  const progress = action && length > 0 ? Math.max(0, Math.min(1, (now - action.startedAt) / length)) : 0;
  const at = place(actor);
  // While lifting or putting down, the name rises and sinks with the speaker instead of jumping.
  const lifting = action && (action.name === "lift" || action.name === "putDown") && moment;
  const headroom = lifting ? CARRY_HEIGHT * Math.max(0, Math.min(1, moment.prop.y / CARRY.y)) : actor.carrying || action ? CARRY_HEIGHT : 0;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: at.left - 90, top: at.top - CHARACTER_SIZE.height - 44 - LABEL_HEIGHT - headroom, width: 180, alignItems: "center", zIndex: depth(actor) }}>
      <View style={{ height: 40, justifyContent: "flex-end", alignItems: "center" }}>
        {!!actor.custom && !sheet.ready && !actor.bubble && <SheetLoading />}
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
      <ActorBody actor={actor} moment={moment} progress={progress} sheet={sheet} />
    </View>
  );
}

const ActorMemo = React.memo(ActorView, (a, b) => a.actor.x === b.actor.x && a.actor.y === b.actor.y && a.actor.bubble === b.actor.bubble && a.actor.label === b.actor.label && a.actor.facing === b.actor.facing && a.actor.walking === b.actor.walking && a.actor.kind === b.actor.kind && a.actor.custom === b.actor.custom && a.actor.name === b.actor.name && a.actor.carrying === b.actor.carrying && a.actor.action === b.actor.action);

/**
 * `onInput` receives the joystick direction while a finger or the mouse is held on the garden, and zero on release.
 * `carriedId` is the speaker a character holds: it is drawn in that character's hands, not on the ground, while
 * its sound shadow follows the position it has in `speakers`. `markers` are pressable things placed in the garden.
 */
export function Scene({ me, actors, speakers, carriedId, heldIds, chatRipples, markers, onInput }: { me: Point; actors: readonly Actor[]; speakers: readonly Speaker[]; carriedId?: string | null; heldIds?: ReadonlySet<string>; chatRipples?: readonly ChatRipple[]; markers?: readonly Marker[]; onInput: (input: Point) => void }) {
  const t = useT();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const targetZoom = useRef(1);
  const zoomAnim = useRef(new Animated.Value(1)).current;
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const root = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = root.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      targetZoom.current = nextZoom(targetZoom.current, event.deltaY);
      Animated.timing(zoomAnim, {
        toValue: targetZoom.current,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomAnim]);
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
      <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: size.width / 2, top: size.height / 2, width: 0, height: 0, transform: [{ scale: zoomAnim }] }}>
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, transform: [{ translateX: -camera.left }, { translateY: -camera.top }] }}>
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
        {(chatRipples ?? []).map((ripple) => (
          <ChatRippleView key={ripple.id} ripple={ripple} />
        ))}
        {TREES.map((tree) => {
          const at = place(tree);
          return (
            <View key={"t" + tree.x + "-" + tree.y} pointerEvents="none" style={{ position: "absolute", left: at.left - TREE_SIZE.width / 2, top: at.top - TREE_SIZE.height + 8, zIndex: depth(tree) }}>
              <Tree kind={tree.kind} />
            </View>
          );
        })}
        {speakers.map((speaker) => {
          if (speaker.id === carriedId || heldIds?.has(speaker.id)) return null;
          const at = place(speaker);
          const playing = loudnessAt(distance(me, speaker), speaker.sound) > 0.01;
          return (
            <View key={speaker.id} pointerEvents="none" style={{ position: "absolute", left: at.left - 70, top: at.top - SPEAKER_SIZE.height - 14, width: 140, alignItems: "center", zIndex: depth(speaker) }}>
              <View style={{ height: 18, backgroundColor: "rgba(255,250,242,0.88)", borderRadius: 9, paddingHorizontal: 7, justifyContent: "center" }}>
                <T size={10.5} weight="700" tone="muted" lines={1}>{speaker.name || defaultSpeakerName(speaker.sound, t)}</T>
              </View>
              <SourceArt look={lookOf(speaker.sound)} playing={playing} />
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
      </Animated.View>
      {stick && (
        <View pointerEvents="none" style={{ position: "absolute", left: stick.x - JOYSTICK_RADIUS, top: stick.y - JOYSTICK_RADIUS, width: JOYSTICK_RADIUS * 2, height: JOYSTICK_RADIUS * 2, borderRadius: JOYSTICK_RADIUS, backgroundColor: "rgba(255,250,242,0.55)", borderWidth: 3, borderColor: "rgba(74,64,56,0.35)" }}>
          <View style={{ position: "absolute", left: JOYSTICK_RADIUS - 3 - 22 + stick.dx, top: JOYSTICK_RADIUS - 3 - 22 + stick.dy, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.accentDeep }} />
        </View>
      )}
    </View>
  );
}
