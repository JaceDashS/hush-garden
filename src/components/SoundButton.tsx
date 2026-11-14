/**
 * The sound button of the top bar. Pressing it turns sound on and off. With a mouse, hovering it makes the button
 * itself grow to the left, uncovering the master volume slider inside the same container, and shows a hint naming
 * the M shortcut; touch screens get only the press.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useT } from "../i18n";
import { DragLockContext, Slider, SpeakerIcon, T, colors } from "../ui";

/** The key that turns sound on and off, matched by its physical position so other keyboard layouts work too. */
export const SOUND_KEY_CODE = "KeyM";
const SIZE = 44;
/** Closing waits this long after the pointer leaves, so a slip off the edge does not fold it at once. */
const CLOSE_DELAY_MS = 250;
/** The button grows to the left in this time, and folds back the same way. */
const UNFOLD_MS = 180;
/** Width the button gains: padding, slider, gap and percentage. */
const EXTRA_WIDTH = 12 + 112 + 6 + 34 + 4;

type PointerEvent = { nativeEvent: { pointerType?: string } };

export function SoundButton({ playing, volume, onToggle, onVolume }: { playing: boolean; volume: number; onToggle: () => void; onVolume: (volume: number) => void }) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopClosing = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };
  useEffect(() => stopClosing, []);
  const enter = (event: PointerEvent) => {
    // Touch and pen taps also send pointer events on the web; only a mouse hovers.
    if (event.nativeEvent.pointerType && event.nativeEvent.pointerType !== "mouse") return;
    stopClosing();
    setHover(true);
  };
  const leave = () => {
    stopClosing();
    closing.current = setTimeout(() => setHover(false), CLOSE_DELAY_MS);
  };
  const open = hover || dragging;
  const unfold = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(unfold, { toValue: open ? 1 : 0, duration: UNFOLD_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [open, unfold]);
  const label = t(playing ? "top.soundOff" : "top.soundOn");
  const hoverProps = { onPointerEnter: enter, onPointerLeave: leave } as object;
  return (
    // The layout keeps the round button's footprint; the one container grows over the bar to its left.
    <View style={{ width: SIZE, height: SIZE }}>
      <Animated.View
        testID="sound-button"
        {...hoverProps}
        style={{ position: "absolute", right: 0, top: 0, height: SIZE, width: unfold.interpolate({ inputRange: [0, 1], outputRange: [SIZE, SIZE + EXTRA_WIDTH] }), flexDirection: "row", justifyContent: "flex-end", overflow: "hidden", borderRadius: SIZE / 2, backgroundColor: colors.white, borderWidth: 2, borderBottomWidth: 4, borderColor: colors.panelEdge }}
      >
        {/* The slider keeps its full width, anchored at the icon, so it is uncovered from right to left. */}
        <Animated.View testID="sound-volume-popup" pointerEvents={open ? "auto" : "none"} style={{ width: EXTRA_WIDTH, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, opacity: unfold.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] }) }}>
          <View style={{ width: 112 }}>
            <DragLockContext.Provider value={setDragging}>
              <Slider bare label={t("settings.volume")} value={volume} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={onVolume} testID="top-volume" />
            </DragLockContext.Provider>
          </View>
          <T size={12} weight="800" style={{ width: 34, textAlign: "right" }}>{Math.round(volume * 100) + "%"}</T>
        </Animated.View>
        <Pressable accessibilityRole="button" accessibilityLabel={label + " (M)"} testID="toggle-sound" onPress={onToggle} style={({ pressed }) => ({ width: SIZE - 4, alignItems: "center", justifyContent: "center", transform: [{ translateY: pressed ? 1 : 0 }] })}>
          <SpeakerIcon on={playing} />
        </Pressable>
      </Animated.View>
      {open && (
        <View pointerEvents="none" testID="sound-shortcut-hint" style={{ position: "absolute", right: 0, top: SIZE + 6, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.ink }}>
          <T size={12} weight="700" tone="white" lines={1}>{label}</T>
          <View style={{ minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: colors.white, alignItems: "center" }}>
            <T size={11.5} weight="800">M</T>
          </View>
        </View>
      )}
    </View>
  );
}
