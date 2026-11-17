import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, View } from "react-native";
import { WebView } from "react-native-webview";
import { SITE_ORIGIN } from "../config";
import type { Language } from "../domain/text";
import { Btn, Card, T, colors } from "../ui";

const copy: Record<Language, { loading: string; failed: string; openBrowser: string; close: string }> = {
  ko: { loading: "불러오는 중…", failed: "페이지를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.", openBrowser: "브라우저에서 열기", close: "닫기" },
  en: { loading: "Loading…", failed: "Could not load the page. Please check your connection.", openBrowser: "Open in browser", close: "Close" },
  ja: { loading: "読み込み中…", failed: "ページを読み込めませんでした。接続を確認してください。", openBrowser: "ブラウザで開く", close: "閉じる" },
  zh: { loading: "加载中…", failed: "无法加载页面，请检查网络连接。", openBrowser: "在浏览器中打开", close: "关闭" },
};

/** Lazy-loaded in-app modal showing a public HTTPS page via iframe (web) or WebView (native). */
export function WebDocDialog({ title, url, language, onClose }: { title: string; url: string; language: Language; onClose: () => void }) {
  const text = copy[language] ?? copy.en;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [url]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeHandler.current();
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, []);

  const openExternal = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      void Linking.openURL(url);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
        <Pressable accessibilityLabel={text.close} onPress={onClose} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(74,64,56,.45)" }} />
        <View style={{ width: "100%", maxWidth: 720, height: "84%", alignSelf: "center" }}>
          <Card title={title} style={{ flex: 1 }}>
            <View style={{ flex: 1, minHeight: 240, borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: colors.panelEdge, backgroundColor: "#fffaf2" }}>
              {failed ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 }}>
                  <T tone="muted" style={{ textAlign: "center" }}>{text.failed}</T>
                  <Btn small variant="mint" title={text.openBrowser} onPress={openExternal} testID="webdoc-fallback-open" />
                </View>
              ) : Platform.OS === "web" ? (
                React.createElement("iframe", {
                  src: url,
                  title,
                  onLoad: () => setLoading(false),
                  onError: () => { setLoading(false); setFailed(true); },
                  style: { width: "100%", height: "100%", border: "none", backgroundColor: "#fffaf2" },
                })
              ) : (
                <WebView
                  source={{ uri: url }}
                  style={{ flex: 1, backgroundColor: "#fffaf2" }}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => { setLoading(false); setFailed(true); }}
                  onHttpError={(event) => {
                    if (event.nativeEvent.statusCode >= 400) {
                      setLoading(false);
                      setFailed(true);
                    }
                  }}
                  onShouldStartLoadWithRequest={(req) => {
                    if (req.url === url || req.url.startsWith(`${SITE_ORIGIN}/hush-garden/`)) return true;
                    void Linking.openURL(req.url);
                    return false;
                  }}
                />
              )}
              {loading && !failed && (
                <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255, 250, 242, 0.85)" }}>
                  <ActivityIndicator color={colors.mintDeep} />
                  <T size={13} tone="muted">{text.loading}</T>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <Btn small title={text.openBrowser} onPress={openExternal} testID="webdoc-open-external" />
              <Btn small variant="primary" title={text.close} onPress={onClose} testID="webdoc-close" />
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}
