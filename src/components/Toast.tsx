/**
 * The one toast of the app: it slides down from the top of the screen, stays its time and slides back up; a tap
 * closes it sooner. Platform notices carry a label; the app's short messages have none. See src/toasts.ts.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissToast, useCurrentToast } from "../toasts";
import { T, colors } from "../ui";

const SLIDE_MS = 280;

export function Toast({ noticeLabel }: { noticeLabel: string }) {
  const toast = useCurrentToast();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const close = (id: string) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(slide, { toValue: 0, duration: SLIDE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      closing.current = false;
      dismissToast(id);
    });
  };
  useEffect(() => {
    if (!toast) return;
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (toast.seconds == null) return;
    const timer = setTimeout(() => close(toast.id), toast.seconds * 1000);
    return () => clearTimeout(timer);
    // The toast restarts only when another one takes the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);
  if (!toast) return null;
  const notice = toast.kind === "notice";
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", zIndex: 200000 }}>
      <Animated.View style={{ marginTop: insets.top + 8, maxWidth: 440, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }], opacity: slide }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={notice ? noticeLabel + ": " + toast.text : toast.text}
          testID={notice ? "notice-toast" : "message-toast"}
          // A lasting toast (the connection is lost) closes by itself when the cause is gone.
          onPress={() => toast.seconds != null && close(toast.id)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.ink, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 }}
        >
          {notice && (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.butter }}>
              <T size={11.5} weight="800">{noticeLabel}</T>
            </View>
          )}
          <T size={13.5} weight="700" tone="white" style={{ flexShrink: 1 }}>{toast.text}</T>
        </Pressable>
      </Animated.View>
    </View>
  );
}
