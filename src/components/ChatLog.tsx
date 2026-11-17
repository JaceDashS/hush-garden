/** Scrollable, vertically resizable nearby chat log shown above the chat input bar. */
import React, { useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, View, type ViewStyle } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { CHAT_ROW_HEIGHT, DEFAULT_CHAT_ROWS, formatChatTime, snapChatRows, type ChatEntry } from "../domain/chat";
import { useT } from "../i18n";
import { T, colors } from "../ui";

const RESIZE_STYLE = (Platform.OS === "web" ? { touchAction: "none", userSelect: "none", cursor: "ns-resize" } : null) as ViewStyle | null;

function ChatLine({ entry, singleLine }: { entry: ChatEntry; singleLine?: boolean }) {
  const t = useT();
  const body = (
    <T size={12.5} lines={singleLine ? 1 : undefined} style={{ flex: 1, flexShrink: 1 }}>
      <T size={12.5} weight="800" style={{ color: entry.mine ? colors.accentDeep : colors.mintDeep }}>
        {entry.name || t("name.me")}
      </T>
      {": "}
      {entry.text}
    </T>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: singleLine ? "center" : "flex-start", gap: 6, minHeight: CHAT_ROW_HEIGHT - 3 }}>
      <T size={11.5} weight="700" tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
        {formatChatTime(entry.at)}
      </T>
      {body}
    </View>
  );
}

function MinimizeIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Line x1={3} y1={7} x2={11} y2={7} stroke={colors.muted} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function MaximizeIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Rect x={3} y={3} width={8} height={8} rx={1.5} fill="none" stroke={colors.muted} strokeWidth={1.8} />
    </Svg>
  );
}

export function ChatLog({ entries }: { entries: readonly ChatEntry[] }) {
  const t = useT();
  const [rows, setRows] = useState(DEFAULT_CHAT_ROWS);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const dragStartRows = useRef(DEFAULT_CHAT_ROWS);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStartRows.current = rowsRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        setRows(snapChatRows(dragStartRows.current, gesture.dy));
      },
    }),
  ).current;

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const listHeight = rows * CHAT_ROW_HEIGHT;

  if (minimized) {
    return (
      <View
        testID="chat-log-box"
        style={{
          backgroundColor: "rgba(255, 250, 242, 0.9)",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: colors.panelEdge,
          paddingHorizontal: 10,
          paddingVertical: 6,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          {latest ? (
            <ChatLine entry={latest} singleLine />
          ) : (
            <T size={12} tone="muted" lines={1}>{t("chat.empty")}</T>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("chat.maximize")}
          onPress={() => setMinimized(false)}
          testID="chat-log-maximize"
          hitSlop={6}
          style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
        >
          <MaximizeIcon />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      testID="chat-log-box"
      style={{
        backgroundColor: "rgba(255, 250, 242, 0.9)",
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.panelEdge,
        paddingHorizontal: 10,
        paddingTop: 2,
        paddingBottom: 8,
        gap: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          {...responder.panHandlers}
          testID="chat-log-resize"
          style={[{ flex: 1, height: 18, alignItems: "center", justifyContent: "center" }, RESIZE_STYLE]}
        >
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.panelEdge }} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("chat.minimize")}
          onPress={() => setMinimized(true)}
          testID="chat-log-minimize"
          hitSlop={6}
          style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
        >
          <MinimizeIcon />
        </Pressable>
      </View>

      {entries.length === 0 ? (
        <View testID="chat-log-empty" style={{ height: listHeight, justifyContent: "flex-start" }}>
          <T size={12} tone="muted">{t("chat.empty")}</T>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ height: listHeight }}
          contentContainerStyle={{ gap: 3 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          nestedScrollEnabled
          testID="chat-log-list"
        >
          {entries.map((entry) => (
            <ChatLine key={entry.id} entry={entry} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
