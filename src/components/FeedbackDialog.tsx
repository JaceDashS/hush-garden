import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import type { HushClient } from "../api/client";
import type { Language } from "../domain/text";
import { Btn, Card, Input, T, colors } from "../ui";

const copy = {
  ko: { title: "피드백", notice: "피드백은 Hush Garden 이름과 함께 메인 사이트 댓글에 공개됩니다.", content: "피드백 내용", password: "수정·삭제용 비밀번호", send: "피드백 보내기", busy: "전송 중…", close: "닫기", sent: "감사합니다. 피드백이 등록되었습니다.", error: "전송하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요." },
  en: { title: "Feedback", notice: "Feedback is posted publicly in the main site comments with Hush Garden.", content: "Your feedback", password: "Password for editing or deleting", send: "Send feedback", busy: "Sending…", close: "Close", sent: "Thank you. Your feedback has been posted.", error: "Could not send feedback. Your text has been kept. Please try again later." },
  ja: { title: "フィードバック", notice: "Hush Garden の名前とともにメインサイトのコメントに公開されます。", content: "内容", password: "編集と削除に使うパスワード", send: "送信", busy: "送信中…", close: "閉じる", sent: "ありがとうございます。投稿しました。", error: "送信できませんでした。入力内容は保持されています。後でもう一度お試しください。" },
  zh: { title: "反馈", notice: "反馈将与 Hush Garden 名称一起公开显示在主站评论中。", content: "反馈内容", password: "用于编辑和删除的密码", send: "发送反馈", busy: "发送中…", close: "关闭", sent: "谢谢，反馈已发布。", error: "发送失败，已保留输入内容，请稍后重试。" },
};

/** Animated composer above settings, using the game's existing account transport. */
export function FeedbackDialog({ client, language, signedIn, onClose }: { client: HushClient; language: Language; signedIn: boolean; onClose: () => void }) {
  const text = copy[language];
  const [content, setContent] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const sending = useRef(false);
  const alive = useRef(true);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!sending.current) closeHandler.current();
    };
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, []);
  useEffect(() => {
    alive.current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive.current) setReducedMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { alive.current = false; listener.remove(); };
  }, []);
  const close = () => { if (!sending.current) onClose(); };
  const submit = async () => {
    if (sending.current || !content.trim() || (!signedIn && !password.trim())) return;
    sending.current = true; setBusy(true); setError(false);
    try {
      await client.submitFeedback(content, password);
      if (alive.current) { setContent(""); setPassword(""); setSent(true); }
    } catch { if (alive.current) setError(true); }
    finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  if (reducedMotion === null) return null;
  return <Modal transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Pressable accessibilityLabel={text.close} onPress={close} style={{ position: "absolute", inset: 0, backgroundColor: "rgba(74,64,56,.45)" }} />
      <View style={{ width: "100%", maxWidth: 480, maxHeight: "90%", alignSelf: "center" }}>
        <Card title={text.title}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <T tone="muted">{text.notice}</T>
            {sent ? <T>{text.sent}</T> : <>
              {!signedIn && <Input label={text.password} placeholder={text.password} value={password} onChangeText={value => { if (!sending.current) setPassword(value); }} secure testID="feedback-password" />}
              <TextInput autoFocus accessibilityLabel={text.content} placeholder={text.content} placeholderTextColor={colors.muted} testID="feedback-content" multiline value={content} editable={!busy} onChangeText={setContent} style={{ minHeight: 120, padding: 12, borderWidth: 1, borderColor: colors.panelEdge, borderRadius: 12, color: colors.ink, backgroundColor: colors.panel, textAlignVertical: "top" }} />
              {error && <T tone="danger">{text.error}</T>}
              <Btn title={busy ? text.busy : text.send} disabled={busy || !content.trim() || (!signedIn && !password.trim())} onPress={() => void submit()} testID="feedback-send" />
            </>}
            <Btn title={text.close} disabled={busy} onPress={close} testID="feedback-close" />
          </ScrollView>
        </Card>
      </View>
    </View>
  </Modal>;
}
