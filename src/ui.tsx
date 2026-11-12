/** Shared pastel UI parts. */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

export const colors = {
  sky: "#dff3ea",
  panel: "#fffaf2",
  panelEdge: "#ecdcc4",
  ink: "#4a4038",
  muted: "#8d7f72",
  accent: "#ff9eb5",
  accentDeep: "#e9728f",
  mint: "#8fd6b4",
  mintDeep: "#5fb893",
  butter: "#ffe08a",
  danger: "#e2645c",
  track: "#eadfce",
  white: "#ffffff",
} as const;

/**
 * Controls that are dragged (sliders, knobs, the equalizer graph) call this with true while a finger is on them and
 * false when it lifts. A scrolling parent provides it to stop scrolling meanwhile, so a drag on a phone moves the
 * control instead of the page.
 */
export const DragLockContext = createContext<(locked: boolean) => void>(() => undefined);
export const useDragLock = () => useContext(DragLockContext);

/** On the web a dragged control must tell the browser not to scroll or select text with the same touch. */
export const NO_TOUCH_SCROLL = (Platform.OS === "web" ? { touchAction: "none", userSelect: "none", cursor: "grab" } : null) as ViewStyle | null;

/** Pixels of drag that turn a knob from one end to the other. */
const KNOB_TRAVEL = 170;

export function T({ children, size = 14, weight = "500", tone = "ink", style, lines }: { children: React.ReactNode; size?: number; weight?: TextStyle["fontWeight"]; tone?: "ink" | "muted" | "danger" | "white"; style?: StyleProp<TextStyle>; lines?: number }) {
  return <Text numberOfLines={lines} style={[{ fontSize: size, fontWeight: weight, color: colors[tone], lineHeight: Math.round(size * 1.4) }, style]}>{children}</Text>;
}

export function Btn({ title, onPress, variant = "plain", disabled, small, testID, style }: { title: string; onPress: () => void; variant?: "primary" | "plain" | "mint" | "danger"; disabled?: boolean; small?: boolean; testID?: string; style?: StyleProp<ViewStyle> }) {
  const fill = { primary: colors.accent, plain: colors.white, mint: colors.mint, danger: colors.white }[variant];
  const edge = { primary: colors.accentDeep, plain: colors.panelEdge, mint: colors.mintDeep, danger: colors.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: small ? 34 : 44, paddingHorizontal: small ? 12 : 18, borderRadius: 999, backgroundColor: fill, borderWidth: 2, borderColor: edge, borderBottomWidth: pressed ? 2 : 4, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }, style]}
    >
      <T size={small ? 13 : 15} weight="700" tone={variant === "danger" ? "danger" : "ink"}>{title}</T>
    </Pressable>
  );
}

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: colors.panel, borderRadius: 24, borderWidth: 2, borderColor: colors.panelEdge, padding: 18, gap: 12 }, style]}>
      {!!title && <T size={19} weight="800">{title}</T>}
      {children}
    </View>
  );
}

export function Input({ label, value, onChangeText, secure, onSubmit, testID, maxLength, placeholder, inputRef, autoFocus, submitBehavior }: { label: string; value: string; onChangeText: (text: string) => void; secure?: boolean; onSubmit?: () => void; testID?: string; maxLength?: number; placeholder?: string; inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>; autoFocus?: boolean; submitBehavior?: "submit" }) {
  return (
    <TextInput ref={inputRef} autoFocus={autoFocus} submitBehavior={submitBehavior}
      accessibilityLabel={label}
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      onSubmitEditing={onSubmit}
      style={{ minHeight: 44, borderRadius: 14, borderWidth: 2, borderColor: colors.panelEdge, backgroundColor: colors.white, paddingHorizontal: 12, fontSize: 15, color: colors.ink }}
    />
  );
}

export function Chips<V extends string>({ label, value, options, onChange }: { label: string; value: V; options: readonly { value: V; label: string }[]; onChange: (value: V) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={{ paddingHorizontal: 12, minHeight: 32, justifyContent: "center", borderRadius: 999, borderWidth: 2, borderColor: selected ? colors.mintDeep : colors.panelEdge, backgroundColor: selected ? colors.mint : colors.white }}>
            <T size={13} weight="700">{option.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const THUMB = 26;

/**
 * Horizontal slider. `log` spreads frequencies evenly by octave. `format` turns the value into the shown text.
 */
export function Slider({ label, value, min, max, onChange, log, format = (v) => String(Math.round(v)), testID }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; log?: boolean; format?: (value: number) => string; testID?: string }) {
  const [width, setWidth] = useState(1);
  const lock = useDragLock();
  const left = useRef(0);
  const track = useRef<React.ComponentRef<typeof View>>(null);
  const latest = useRef({ width, min, max, log, onChange, lock });
  latest.current = { width, min, max, log, onChange, lock };
  const toRatio = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPage = (pageX: number) => {
    const s = latest.current;
    // The thumb's centre travels between THUMB / 2 from each end, so it is never cut off at 0 or 100 %.
    const ratio = Math.max(0, Math.min(1, (pageX - left.current - THUMB / 2) / Math.max(1, s.width - THUMB)));
    s.onChange(s.log ? s.min * Math.pow(s.max / s.min, ratio) : s.min + (s.max - s.min) * ratio);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const pageX = event.nativeEvent.pageX;
        latest.current.lock(true);
        track.current?.measureInWindow((x) => {
          left.current = x;
          fromPage(pageX);
        });
      },
      onPanResponderMove: (event) => fromPage(event.nativeEvent.pageX),
      onPanResponderRelease: () => latest.current.lock(false),
      onPanResponderTerminate: () => latest.current.lock(false),
    }),
  ).current;
  const ratio = Math.max(0, Math.min(1, toRatio(value)));
  const stepBy = (direction: number) => {
    const next = Math.max(0, Math.min(1, ratio + direction * 0.05));
    onChange(log ? min * Math.pow(max / min, next) : min + (max - min) * next);
  };
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T size={12.5} tone="muted" weight="700">{label}</T>
        <T size={12.5} weight="700">{format(value)}</T>
      </View>
      <View
        ref={track}
        testID={testID}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => stepBy(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={[{ height: 36, justifyContent: "center" }, NO_TOUCH_SCROLL]}
        {...responder.panHandlers}
      >
        <View style={{ height: 8, borderRadius: 4, marginHorizontal: THUMB / 2, backgroundColor: colors.track }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.mint, width: `${ratio * 100}%` }} />
        </View>
        <View pointerEvents="none" style={{ position: "absolute", left: ratio * Math.max(0, width - THUMB), width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.mintDeep }} />
      </View>
    </View>
  );
}

/**
 * A round knob in the manner of synthesiser panels. Dragging up or to the right raises the value and dragging
 * down or to the left lowers it, so it works with a mouse and with a thumb. `log` spreads frequencies by octave.
 */
export function Knob({ label, value, min, max, onChange, log, format = (v) => String(Math.round(v)), size = 64, color = colors.mintDeep, testID }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; log?: boolean; format?: (value: number) => string; size?: number; color?: string; testID?: string }) {
  const lock = useDragLock();
  const toRatio = (v: number) => Math.max(0, Math.min(1, log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min)));
  const fromRatio = (ratio: number) => (log ? min * Math.pow(max / min, ratio) : min + (max - min) * ratio);
  const ratio = toRatio(value);
  const latest = useRef({ ratio, fromRatio, onChange, lock });
  latest.current = { ratio, fromRatio, onChange, lock };
  const start = useRef(0);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.ratio;
        latest.current.lock(true);
      },
      onPanResponderMove: (_event, gesture) => {
        const next = Math.max(0, Math.min(1, start.current + (gesture.dx - gesture.dy) / KNOB_TRAVEL));
        latest.current.onChange(latest.current.fromRatio(next));
      },
      onPanResponderRelease: () => latest.current.lock(false),
      onPanResponderTerminate: () => latest.current.lock(false),
    }),
  ).current;
  const stepBy = (direction: number) => onChange(fromRatio(Math.max(0, Math.min(1, ratio + direction * 0.05))));
  const middle = size / 2;
  const radius = size / 2 - 5;
  const at = (share: number, length: number) => {
    const angle = ((-225 + share * 270) * Math.PI) / 180;
    return { x: middle + Math.cos(angle) * length, y: middle + Math.sin(angle) * length };
  };
  const arc = (share: number) => {
    const from = at(0, radius);
    const to = at(share, radius);
    return "M" + from.x.toFixed(1) + " " + from.y.toFixed(1) + " A" + radius + " " + radius + " 0 " + (share * 270 > 180 ? 1 : 0) + " 1 " + to.x.toFixed(1) + " " + to.y.toFixed(1);
  };
  const tip = at(ratio, radius - 9);
  const tail = at(ratio, radius - 20);
  return (
    <View style={{ alignItems: "center", gap: 2, minWidth: size + 12 }}>
      <View
        testID={testID}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: format(value) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => stepBy(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        style={[{ width: size, height: size }, NO_TOUCH_SCROLL]}
        {...responder.panHandlers}
      >
        <Svg width={size} height={size} pointerEvents="none">
          <Path d={arc(1)} stroke={colors.track} strokeWidth={5} fill="none" strokeLinecap="round" />
          {ratio > 0.005 && <Path d={arc(ratio)} stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />}
          <Circle cx={middle} cy={middle} r={radius - 7} fill={colors.white} stroke={colors.ink} strokeWidth={2} />
          <Line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </View>
      <T size={11.5} tone="muted" weight="700">{label}</T>
      <T size={12.5} weight="800">{format(value)}</T>
    </View>
  );
}

/** A round button that shows a picture instead of text. `label` is what screen readers say. */
export function IconBtn({ label, onPress, children, size = 44, variant = "plain", testID }: { label: string; onPress: () => void; children: React.ReactNode; size?: number; variant?: "plain" | "mint"; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: variant === "mint" ? colors.mint : colors.white, borderWidth: 2, borderColor: variant === "mint" ? colors.mintDeep : colors.panelEdge, borderBottomWidth: pressed ? 2 : 4, alignItems: "center", justifyContent: "center" })}
    >
      {children}
    </Pressable>
  );
}

/** A row of tabs; the chosen one is filled. */
export function Tabs<V extends string>({ value, options, onChange }: { value: V; options: readonly { value: V; label: string }[]; onChange: (value: V) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: colors.track, borderRadius: 14, padding: 3, gap: 3 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected }} testID={"tab-" + option.value} onPress={() => onChange(option.value)} style={{ flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: selected ? colors.white : "transparent" }}>
            <T size={13} weight="800" tone={selected ? "ink" : "muted"} lines={1}>{option.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The gear picture of the settings button. */
export function GearIcon({ size = 24 }: { size?: number }) {
  const teeth = Array.from({ length: 8 }, (_, index) => index * 45);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      {teeth.map((angle) => (
        <Rect key={angle} x={10.4} y={1.6} width={3.2} height={5} rx={1.2} fill={colors.ink} transform={"rotate(" + angle + " 12 12)"} />
      ))}
      <Circle cx={12} cy={12} r={7} fill={colors.ink} />
      <Circle cx={12} cy={12} r={3} fill={colors.white} />
    </Svg>
  );
}

/** Dimmed full-screen layer with a centered card. */
/**
 * Style that keeps a view laid out and ready but invisible and untouchable. On the web it is also taken out of
 * keyboard focus. Used to prepare screens before they are shown.
 */
export const HIDDEN_READY: ViewStyle = { opacity: 0, ...(Platform.OS === "web" ? ({ visibility: "hidden" } as ViewStyle) : null) };

/** Frames to wait after the first layout, so measured children (sliders, graphs, scrolled rows) have settled. */
const SETTLE_FRAMES = 3;

/**
 * Shows its children only once they are ready: it lays them out invisibly first, waits until the measurements
 * that depend on that layout have been applied, and then reveals them in one go, so a half-built screen never
 * flashes. With `hidden` it stays invisible but keeps everything mounted and laid out, ready to show at once.
 */
export function Prepared({ children, hidden = false, style }: { children: React.ReactNode; hidden?: boolean; style?: StyleProp<ViewStyle> }) {
  const [ready, setReady] = useState(false);
  const started = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);
  const onLayout = () => {
    if (started.current) return;
    started.current = true;
    let frames = SETTLE_FRAMES;
    const tick = () => {
      if (!alive.current) return;
      if (--frames <= 0) setReady(true);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const shown = ready && !hidden;
  return (
    <View onLayout={onLayout} pointerEvents={shown ? "auto" : "none"} aria-hidden={!shown} style={[style, shown ? null : HIDDEN_READY]}>
      {children}
    </View>
  );
}

/** A centred card over a dimmed backdrop. With `hidden` it is kept prepared but not shown, so it opens at once. */
export function Modal({ children, onClose, hidden = false }: { children: React.ReactNode; onClose?: () => void; hidden?: boolean }) {
  return (
    <Prepared hidden={hidden} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: hidden ? -1 : 50, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Pressable accessibilityLabel="닫기" onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(74, 64, 56, 0.45)" }} />
      <View style={{ width: "100%", maxWidth: 380, maxHeight: "92%" }}>{children}</View>
    </Prepared>
  );
}
