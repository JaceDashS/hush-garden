/**
 * A platform notice as a toast that slides down from the top of the screen, stays a few seconds and slides back
 * up; a tap closes it sooner. Queued notices follow one after another.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissNotice, useCurrentNotice } from "../api/notices";
import { T, colors } from "../ui";

/** How long a notice stays, and how long it takes to slide in or out. */
export const NOTICE_SECONDS = 7;
const SLIDE_MS = 280;

export function NoticeToast({ label }: { label: string }) {
  const notice = useCurrentNotice();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const close = (id: string) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      closing.current = false;
      dismissNotice(id);
    });
  };
  useEffect(() => {
    if (!notice) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => close(notice.id), NOTICE_SECONDS * 1000);
    return () => clearTimeout(timer);
    // The toast restarts for each new notice only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id]);
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", zIndex: 200000 }}>
      <Animated.View style={{ marginTop: insets.top + 8, maxWidth: 440, width: "92%", transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }], opacity: slide }}>
        <Pressable accessibilityRole="alert" accessibilityLabel={label + ": " + notice.title} testID="notice-toast" onPress={() => close(notice.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 }}>
          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.butter }}>
            <T size={11.5} weight="800">{label}</T>
          </View>
          <T size={13.5} weight="700" tone="white" style={{ flex: 1 }}>{notice.title}</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}
