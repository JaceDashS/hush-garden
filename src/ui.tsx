/** Shared pastel UI parts. */
import React, { useRef, useState } from "react";
import { PanResponder, Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

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

/**
 * Horizontal slider. `log` spreads frequencies evenly by octave. `format` turns the value into the shown text.
 */
export function Slider({ label, value, min, max, onChange, log, format = (v) => String(Math.round(v)), testID }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; log?: boolean; format?: (value: number) => string; testID?: string }) {
  const [width, setWidth] = useState(1);
  const left = useRef(0);
  const track = useRef<React.ComponentRef<typeof View>>(null);
  const latest = useRef({ width, min, max, log, onChange });
  latest.current = { width, min, max, log, onChange };
  const toRatio = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPage = (pageX: number) => {
    const s = latest.current;
    const ratio = Math.max(0, Math.min(1, (pageX - left.current) / s.width));
    s.onChange(s.log ? s.min * Math.pow(s.max / s.min, ratio) : s.min + (s.max - s.min) * ratio);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const pageX = event.nativeEvent.pageX;
        track.current?.measureInWindow((x) => {
          left.current = x;
          fromPage(pageX);
        });
      },
      onPanResponderMove: (event) => fromPage(event.nativeEvent.pageX),
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
        style={{ height: 30, justifyContent: "center" }}
        {...responder.panHandlers}
      >
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.mint, width: `${ratio * 100}%` }} />
        </View>
        <View pointerEvents="none" style={{ position: "absolute", left: ratio * width - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.mintDeep }} />
      </View>
    </View>
  );
}

/** Dimmed full-screen layer with a centered card. */
export function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Pressable accessibilityLabel="닫기" onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(74, 64, 56, 0.45)" }} />
      <View style={{ width: "100%", maxWidth: 380, maxHeight: "92%" }}>{children}</View>
    </View>
  );
}
