/**
 * The status pill in the middle of the top bar: the garden and how many speakers are heard. While the nature sounds
 * download, its content crossfades into a gauge that fills the whole pill (no text, no numbers) and crossfades
 * back when they are done.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { T, colors } from "../ui";

/** How long the pill takes to turn into the gauge and back. */
const SWITCH_MS = 320;

export function GardenStatus({ title, detail, progress, gaugeLabel }: { title: string; detail: string; progress: number | null; gaugeLabel: string }) {
  const gauge = progress != null;
  const mix = useRef(new Animated.Value(gauge ? 1 : 0)).current;
  const fill = useRef(new Animated.Value(progress ?? 0)).current;
  useEffect(() => {
    const animation = Animated.timing(mix, { toValue: gauge ? 1 : 0, duration: SWITCH_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [gauge, mix]);
  useEffect(() => {
    if (progress == null) return;
    const animation = Animated.timing(fill, { toValue: progress, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [progress, fill]);
  return (
    <View pointerEvents="none" testID="garden-status" style={{ flex: 1, minWidth: 0, borderRadius: 14, backgroundColor: "rgba(255,250,242,0.92)", paddingHorizontal: 12, paddingVertical: 4, alignItems: "center", overflow: "hidden" }}>
      <Animated.View style={{ maxWidth: "100%", alignItems: "center", opacity: mix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: mix.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] }}>
        <T size={12} weight="800" lines={1}>{title}</T>
        <T size={11.5} weight="700" tone="muted" lines={1}>{detail}</T>
      </Animated.View>
      {/* The gauge lies over the same pill; the text keeps the pill's size while it is hidden. */}
      <Animated.View
        testID="garden-status-gauge"
        accessibilityRole="progressbar"
        accessibilityLabel={gaugeLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round((progress ?? 0) * 100) }}
        style={{ position: "absolute", left: 10, right: 10, top: 0, bottom: 0, justifyContent: "center", opacity: mix, transform: [{ scale: mix.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] }}
      >
        <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.track, overflow: "hidden" }}>
          <Animated.View style={{ height: 12, borderRadius: 6, backgroundColor: colors.mintDeep, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
        </View>
      </Animated.View>
    </View>
  );
}
