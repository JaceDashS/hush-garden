/**
 * The sound button of the top bar. Pressing it turns sound on and off. With a mouse, hovering it shows the master
 * volume slider growing to the left and a hint naming the M shortcut; touch screens get only the press.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { useT } from "../i18n";
import { DragLockContext, IconBtn, Slider, SpeakerIcon, T, colors } from "../ui";

/** The key that turns sound on and off, matched by its physical position so other keyboard layouts work too. */
export const SOUND_KEY_CODE = "KeyM";
const SIZE = 44;
/** Moving the pointer from the button to the slider crosses a small gap; closing waits this long. */
const CLOSE_DELAY_MS = 250;
/** The slider pill grows out of the button to the left in this time, and folds back the same way. */
const UNFOLD_MS = 180;
/** Full width of the slider pill: padding, slider, gap, percentage and border. */
const PILL_WIDTH = 12 + 112 + 6 + 34 + 14 + 4;

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
  // The pill stays drawn while it folds back, and is removed once folded.
  const [shown, setShown] = useState(open);
  const unfold = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) setShown(true);
    const animation = Animated.timing(unfold, { toValue: open ? 1 : 0, duration: UNFOLD_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => {
      if (finished && !open) setShown(false);
    });
    return () => animation.stop();
  }, [open, unfold]);
  const label = t(playing ? "top.soundOff" : "top.soundOn");
  const hoverProps = { onPointerEnter: enter, onPointerLeave: leave } as object;
  return (
    <View style={{ width: SIZE, height: SIZE }} {...hoverProps}>
      {shown && (
        // The outer box grows from the button's edge; the content keeps its full width, anchored at the button, so
        // it is uncovered from right to left instead of being squeezed.
        <Animated.View testID="sound-volume-popup" style={{ position: "absolute", right: SIZE - 4, top: 0, height: SIZE, width: unfold.interpolate({ inputRange: [0, 1], outputRange: [0, PILL_WIDTH] }), opacity: unfold.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), overflow: "hidden", alignItems: "flex-end", borderRadius: SIZE / 2, backgroundColor: "rgba(255,250,242,0.96)", borderWidth: 2, borderColor: colors.panelEdge }}>
          <View style={{ width: PILL_WIDTH - 4, height: SIZE - 4, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 14 }}>
            <View style={{ width: 112 }}>
              <DragLockContext.Provider value={setDragging}>
                <Slider bare label={t("settings.volume")} value={volume} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={onVolume} testID="top-volume" />
              </DragLockContext.Provider>
            </View>
            <T size={12} weight="800" style={{ width: 34, textAlign: "right" }}>{Math.round(volume * 100) + "%"}</T>
          </View>
        </Animated.View>
      )}
      <IconBtn label={label + " (M)"} onPress={onToggle} testID="toggle-sound">
        <SpeakerIcon on={playing} />
      </IconBtn>
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
