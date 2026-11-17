/** Scrollable nearby chat log shown above the chat input bar. */
import React, { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { formatChatTime, type ChatEntry } from "../domain/chat";
import { useT } from "../i18n";
import { T, colors } from "../ui";

export function ChatLog({ entries }: { entries: readonly ChatEntry[] }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  return (
    <View
      testID="chat-log-box"
      style={{
        backgroundColor: "rgba(255, 250, 242, 0.9)",
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.panelEdge,
        paddingHorizontal: 10,
        paddingVertical: 7,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T size={11.5} weight="800" tone="muted">{t("chat.logTitle")}</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(open ? "chat.hide" : "chat.show")}
          onPress={() => setOpen((value) => !value)}
          testID="chat-log-toggle"
          hitSlop={6}
        >
          <T size={11.5} weight="700" tone="muted">{t(open ? "chat.hide" : "chat.show")}</T>
        </Pressable>
      </View>

      {open && (
        entries.length === 0 ? (
          <View testID="chat-log-empty">
            <T size={12} tone="muted">{t("chat.empty")}</T>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ maxHeight: 132 }}
            contentContainerStyle={{ gap: 3 }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            nestedScrollEnabled
            testID="chat-log-list"
          >
            {entries.map((entry) => (
              <View key={entry.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                <T size={11.5} weight="700" tone="muted" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatChatTime(entry.at)}
                </T>
                <T size={12.5} style={{ flex: 1, flexShrink: 1 }}>
                  <T size={12.5} weight="800" style={{ color: entry.mine ? colors.accentDeep : colors.mintDeep }}>
                    {entry.name || t("name.me")}
                  </T>
                  {": "}
                  {entry.text}
                </T>
              </View>
            ))}
          </ScrollView>
        )
      )}
    </View>
  );
}
