/**
 * Top bar sound control. Compact screens reveal a vertical volume slider on the first press and M/S
 * bubbles to the left; wide screens reveal the horizontal slider to the left and M/S bubbles below on hover.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useT } from "../i18n";
import { DragLockContext, Slider, SpeakerIcon, T, colors } from "../ui";

/** The key that turns sound on and off, matched by its physical position so other keyboard layouts work too. */
export const SOUND_KEY_CODE = "KeyM";
const SIZE = 44;
/** Closing waits this long after the pointer leaves, so a slip off the edge does not fold it at once. */
const CLOSE_DELAY_MS = 250;
/** The button grows in this time, and folds back the same way. */
const UNFOLD_MS = 240;
const DROP_HEIGHT = 170;
/** Width the button gains: padding, slider, gap and percentage. */
const EXTRA_WIDTH = 12 + 112 + 6 + 34 + 4;
const BUBBLE_SIZE = 36;
const BUBBLE_GAP = 6;

type HoverEvent = { nativeEvent: { pointerType?: string } };

function ChannelBubble({
  label,
  accessibilityLabel,
  selected,
  onPress,
  testID,
  anim,
  open,
  compact,
  index,
  hoverProps,
}: {
  label: "M" | "S";
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  anim: Animated.Value;
  open: boolean;
  compact: boolean;
  index: number;
  hoverProps: object;
}) {
  const centerOffset = (SIZE - BUBBLE_SIZE) / 2;
  const position = compact
    ? {
        right: SIZE + BUBBLE_GAP,
        top: centerOffset + index * (BUBBLE_SIZE + BUBBLE_GAP),
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [14 + index * 6, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
        ],
      }
    : {
        right: (1 - index) * (BUBBLE_SIZE + BUBBLE_GAP),
        top: SIZE + BUBBLE_GAP,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14 - index * 6, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
        ],
      };

  return (
    <Animated.View
      {...hoverProps}
      pointerEvents={open ? "auto" : "none"}
      aria-hidden={!open}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={{
        position: "absolute",
        ...position,
        opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => ({
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          borderRadius: BUBBLE_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderBottomWidth: pressed ? 2 : 4,
          borderColor: selected ? colors.mintDeep : colors.panelEdge,
          backgroundColor: selected ? colors.mint : colors.white,
        })}
      >
        <T size={13} weight="800">{label}</T>
      </Pressable>
    </Animated.View>
  );
}

export function SoundButton({ compact = false, playing, volume, mono, onToggle, onVolume, onMono }: { compact?: boolean; playing: boolean; volume: number; mono: boolean; onToggle: () => void; onVolume: (volume: number) => void; onMono: (mono: boolean) => void }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const container = useRef<React.ComponentRef<typeof View>>(null);
  const viewport = useWindowDimensions();
  useEffect(() => {
    setExpanded(false);
    setHover(false);
  }, [compact]);
  useEffect(() => {
    if (Platform.OS !== "web" || !expanded) return;
    const dismiss = (event: PointerEvent) => {
      const element = container.current as unknown as HTMLElement | null;
      if (element && !element.contains(event.target as Node | null)) setExpanded(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setExpanded(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [expanded]);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopClosing = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };
  useEffect(() => stopClosing, []);
  const enter = (event: HoverEvent) => {
    // Touch and pen taps also send pointer events on the web; only a mouse hovers.
    if (compact || (event.nativeEvent.pointerType && event.nativeEvent.pointerType !== "mouse")) return;
    stopClosing();
    setHover(true);
  };
  const leave = () => {
    stopClosing();
    closing.current = setTimeout(() => setHover(false), CLOSE_DELAY_MS);
  };
  const open = (compact ? expanded : hover) || dragging;
  const unfold = useRef(new Animated.Value(0)).current;
  const pop1 = useRef(new Animated.Value(0)).current;
  const pop2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(unfold, { toValue: open ? 1 : 0, duration: UNFOLD_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    const bubbles = open
      ? Animated.stagger(75, [
          Animated.spring(pop1, { toValue: 1, speed: 18, bounciness: 14, useNativeDriver: false }),
          Animated.spring(pop2, { toValue: 1, speed: 18, bounciness: 14, useNativeDriver: false }),
        ])
      : Animated.parallel([
          Animated.timing(pop1, { toValue: 0, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
          Animated.timing(pop2, { toValue: 0, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
        ]);
    animation.start();
    bubbles.start();
    return () => {
      animation.stop();
      bubbles.stop();
    };
  }, [open, unfold, pop1, pop2]);
  const label = t(playing ? "top.soundOff" : "top.soundOn");
  const hoverProps = { onPointerEnter: enter, onPointerLeave: leave } as object;
  return (
    // Keep the round button's footprint while the slider and M/S bubbles unfold beside or below it.
    <View ref={container} style={{ width: SIZE, height: SIZE, zIndex: 10 }}>
      {compact && expanded && Platform.OS !== "web" && <Pressable accessibilityLabel={t("settings.volume")} onPress={() => setExpanded(false)} style={{ position: "absolute", left: -viewport.width, top: -viewport.height, width: viewport.width * 2, height: viewport.height * 2 }} />}
      <Animated.View
        testID="sound-button"
        {...hoverProps}
        style={{ position: "absolute", right: 0, top: 0, height: compact ? unfold.interpolate({ inputRange: [0, 1], outputRange: [SIZE, SIZE + DROP_HEIGHT] }) : SIZE, width: unfold.interpolate({ inputRange: [0, 1], outputRange: [SIZE, compact ? SIZE : SIZE + EXTRA_WIDTH] }), flexDirection: "row", justifyContent: "flex-end", overflow: "hidden", borderRadius: SIZE / 2, backgroundColor: colors.white, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.panelEdge }}
      >
        {/* Keep the slider at full width while its container unfolds. */}
        <Animated.View testID="sound-volume-popup" pointerEvents={open ? "auto" : "none"} aria-hidden={!open} accessibilityElementsHidden={!open} importantForAccessibility={open ? "auto" : "no-hide-descendants"} style={{ ...(compact ? { position: "absolute" as const, left: 0, top: SIZE - 2, width: SIZE - 4, height: DROP_HEIGHT, flexDirection: "column" as const, paddingTop: 4 } : { width: EXTRA_WIDTH, flexDirection: "row" as const, paddingLeft: 12 }), alignItems: "center", gap: 6, opacity: unfold.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] }), transform: compact ? [{ translateY: unfold.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] : [] }}>
          <View style={{ width: compact ? 36 : 112 }}>
            <DragLockContext.Provider value={setDragging}>
              <Slider bare vertical={compact} label={t("settings.volume")} value={volume} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={onVolume} testID="top-volume" />
            </DragLockContext.Provider>
          </View>
          <T size={compact ? 10 : 12} weight="800" style={{ width: 34, textAlign: compact ? "center" : "right" }}>{Math.round(volume * 100) + "%"}</T>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel={compact && !expanded ? t("settings.volume") : label} aria-expanded={compact ? expanded : undefined} accessibilityState={compact ? { expanded } : undefined} testID="toggle-sound" onPress={() => { if (compact && !expanded) setExpanded(true); else onToggle(); }} style={({ pressed }) => ({ width: SIZE - 4, height: SIZE - 6, alignItems: "center", justifyContent: "center", transform: [{ translateY: pressed ? 1 : 0 }] })}>
          <SpeakerIcon on={playing} />
        </Pressable>
      </Animated.View>

      {/* Independent bouncing S / M bubbles: horizontal S M below on desktop, vertical S-top M-bottom to the left on mobile. */}
      <ChannelBubble label="S" accessibilityLabel={t("channel.stereo")} selected={!mono} onPress={() => onMono(false)} testID="sound-stereo" anim={pop1} open={open} compact={compact} index={0} hoverProps={hoverProps} />
      <ChannelBubble label="M" accessibilityLabel={t("channel.mono")} selected={mono} onPress={() => onMono(true)} testID="sound-mono" anim={pop2} open={open} compact={compact} index={1} hoverProps={hoverProps} />
    </View>
  );
}
