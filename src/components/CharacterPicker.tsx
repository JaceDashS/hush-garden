/**
 * The row of characters to choose from, used on the title screen and in the settings. The arrow buttons, and on
 * the web the left and right arrow keys when `arrowKeys` is on, choose the previous or next character. The row
 * scrolls so the chosen character is always fully in view.
 */
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { CHARACTER_KINDS, scrollToShow, stepCharacter, type CharacterKind } from "../domain/characters";
import type { TextKey } from "../domain/text";
import { Character } from "../game/characters";
import { useT } from "../i18n";
import { T, colors } from "../ui";

function Arrow({ direction, label, onPress }: { direction: 1 | -1; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} testID={"character-" + (direction > 0 ? "next" : "previous")} hitSlop={6} style={{ width: 30, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 2, borderColor: colors.panelEdge }}>
      <Svg width={12} height={16} viewBox="0 0 12 16" pointerEvents="none">
        <Path d={direction > 0 ? "M3 2 L9 8 L3 14" : "M9 2 L3 8 L9 14"} stroke={colors.ink} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

export function CharacterPicker({ value, onChange, arrowKeys = false }: { value: CharacterKind; onChange: (kind: CharacterKind) => void; arrowKeys?: boolean }) {
  const t = useT();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const items = useRef<Partial<Record<CharacterKind, { x: number; width: number }>>>({});
  const view = useRef({ offset: 0, width: 0 });
  const [laidOut, setLaidOut] = useState(0);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  useEffect(() => {
    if (!arrowKeys || Platform.OS !== "web" || typeof window === "undefined") return;
    const down = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      latest.current.onChange(stepCharacter(latest.current.value, event.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [arrowKeys]);

  // Whenever the choice changes, or the row has just been measured, bring the chosen character into view. When
  // the row first appears it is simply shown at that place; only a later change of choice scrolls smoothly.
  const shownValue = useRef<CharacterKind | null>(null);
  useEffect(() => {
    const item = items.current[value];
    if (!item || view.current.width <= 0) return;
    const animated = shownValue.current !== null && shownValue.current !== value;
    shownValue.current = value;
    const target = scrollToShow(item, view.current);
    if (target === null) return;
    view.current.offset = target;
    scroll.current?.scrollTo({ x: target, animated });
  }, [value, laidOut]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Arrow direction={-1} label={t("character.previous")} onPress={() => onChange(stepCharacter(value, -1))} />
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
        scrollEventThrottle={32}
        onScroll={(event) => {
          view.current.offset = event.nativeEvent.contentOffset.x;
        }}
        onLayout={(event) => {
          view.current.width = event.nativeEvent.layout.width;
          setLaidOut((n) => n + 1);
        }}
      >
        {CHARACTER_KINDS.map((kind) => {
          const selected = kind === value;
          const name = t(("character." + kind) as TextKey);
          return (
            <Pressable
              key={kind}
              accessibilityRole="radio"
              accessibilityLabel={name}
              accessibilityState={{ selected }}
              testID={"character-" + kind}
              onPress={() => onChange(kind)}
              onLayout={(event) => {
                items.current[kind] = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width };
                if (kind === latest.current.value) setLaidOut((n) => n + 1);
              }}
              style={{ alignItems: "center", paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2, borderRadius: 16, borderWidth: 2, borderColor: selected ? colors.mintDeep : "transparent", backgroundColor: selected ? "#e6f6ee" : "transparent" }}
            >
              <Character kind={kind} />
              <T size={11} weight="700" tone={selected ? "ink" : "muted"}>{name}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <Arrow direction={1} label={t("character.next")} onPress={() => onChange(stepCharacter(value, 1))} />
    </View>
  );
}
