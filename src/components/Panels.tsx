/** Cards shown over the garden: location consent, login, presets and settings. */
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import type { HushClient } from "../api/client";
import { ApiError, type User } from "../api/types";
import type { CueMode } from "../domain/chat";
import { BUILT_IN_PRESETS, MAX_PRESETS, type MyGarden } from "../domain/garden";
import type { Settings } from "../settings";
import { Btn, Card, Chips, Input, Slider, T, colors } from "../ui";
import { GoogleButton } from "./GoogleButton";

/** Explains what location is used for before the public garden opens. Nothing is requested until the user agrees. */
export function ConsentCard({ busy, error, onAgree, onCancel }: { busy: boolean; error: string; onAgree: () => void; onCancel: () => void }) {
  return (
    <Card title="위치 정보 동의">
      <T size={14}>모두의 정원에서는 캐릭터 위에 접속한 도시 이름이 표시됩니다.</T>
      <View style={{ gap: 4 }}>
        <T size={13} tone="muted">· 기기 위치 권한을 허용하면 그 위치의 도시 이름을, 허용하지 않으면 인터넷 주소로 추정한 도시 이름을 씁니다.</T>
        <T size={13} tone="muted">· 좌표는 약 1km 단위로 뭉개서 보내고, 서버는 도시 이름만 남기며 좌표는 저장하지 않습니다.</T>
        <T size={13} tone="muted">· 다른 사람에게는 도시와 나라 이름만 보입니다.</T>
        <T size={13} tone="muted">· 채팅 내용은 서버 기록에 남습니다.</T>
      </View>
      {!!error && <T size={13} tone="danger">{error}</T>}
      <Btn variant="primary" title={busy ? "들어가는 중" : "동의하고 들어가기"} disabled={busy} onPress={onAgree} testID="consent-agree" />
      <Btn title="돌아가기" disabled={busy} onPress={onCancel} testID="consent-cancel" />
    </Card>
  );
}

const LOGIN_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "아이디 또는 비밀번호가 맞지 않습니다.",
  EMAIL_NOT_VERIFIED: "이메일 인증을 마친 뒤 로그인할 수 있습니다.",
  RATE_LIMITED: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.",
};

/** jace-s account login. Chat needs it; walking and listening do not. */
export function LoginCard({ client, onLoggedIn, onClose }: { client: HushClient; onLoggedIn: (user: User) => Promise<void>; onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await onLoggedIn(await client.login(username, password, remember));
    } catch (cause) {
      setError((cause instanceof ApiError && LOGIN_ERRORS[cause.code]) || "로그인하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };
  return (
    <Card title="로그인">
      <T size={13} tone="muted">jace-s 계정으로 로그인하면 주변 사람과 채팅할 수 있습니다.</T>
      <GoogleButton client={client} remember={remember} disabled={busy} onBusyChange={setBusy} onLoggedIn={onLoggedIn} />
      <Input label="아이디" placeholder="아이디" value={username} onChangeText={setUsername} testID="login-username" />
      <Input label="비밀번호" placeholder="비밀번호" value={password} onChangeText={setPassword} secure onSubmit={() => void submit()} testID="login-password" />
      {Platform.OS === "web" && (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} accessibilityLabel="로그인 유지" onPress={() => setRemember(!remember)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: remember ? colors.mintDeep : colors.panelEdge, backgroundColor: remember ? colors.mint : colors.white }} />
          <T size={13} tone="muted">로그인 유지</T>
        </Pressable>
      )}
      {!!error && <T size={13} tone="danger">{error}</T>}
      <Btn variant="primary" title={busy ? "로그인 중" : "로그인"} disabled={busy || !username.trim() || !password} onPress={() => void submit()} testID="login-submit" />
      <Btn title="닫기" onPress={onClose} />
    </Card>
  );
}

/** Private garden presets: apply a built-in or saved layout, save the current one, delete, or reset everything. */
export function PresetCard({ garden, onApply, onSave, onDelete, onReset, onClose }: { garden: MyGarden; onApply: (id: string) => void; onSave: (name: string) => void; onDelete: (id: string) => void; onReset: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Card title="프리셋">
      <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 8 }}>
        <T size={12.5} tone="muted" weight="700">기본 프리셋</T>
        {BUILT_IN_PRESETS.map((preset) => (
          <Btn key={preset.id} small title={preset.name + " 불러오기"} onPress={() => onApply(preset.id)} testID={"preset-" + preset.id} />
        ))}
        <T size={12.5} tone="muted" weight="700">내 프리셋</T>
        {garden.presets.length === 0 && <T size={13} tone="muted">아직 저장한 프리셋이 없습니다.</T>}
        {garden.presets.map((preset) => (
          <View key={preset.id} style={{ flexDirection: "row", gap: 6 }}>
            <Btn small title={preset.name + " 불러오기"} onPress={() => onApply(preset.id)} style={{ flex: 1 }} />
            <Btn small variant="danger" title="삭제" onPress={() => onDelete(preset.id)} />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Input label="새 프리셋 이름" placeholder="새 프리셋 이름" value={name} maxLength={24} onChangeText={setName} testID="preset-name" />
        </View>
        <Btn
          variant="mint"
          title="저장"
          disabled={!name.trim() || garden.presets.length >= MAX_PRESETS}
          onPress={() => {
            onSave(name);
            setName("");
          }}
          testID="preset-save"
        />
      </View>
      <T size={12} tone="muted">지금 정원의 스피커 배치와 소리를 내 프리셋으로 저장합니다. 같은 이름은 덮어씁니다.</T>
      {confirmReset ? (
        <View style={{ gap: 6 }}>
          <T size={13} tone="danger">내 정원과 내 프리셋이 모두 처음 상태로 돌아갑니다.</T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Btn small variant="danger" title="초기화" onPress={() => { setConfirmReset(false); onReset(); }} testID="preset-reset-confirm" />
            <Btn small title="취소" onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      ) : (
        <Btn small variant="danger" title="처음 상태로 초기화" onPress={() => setConfirmReset(true)} testID="preset-reset" />
      )}
      <Btn title="닫기" onPress={onClose} />
    </Card>
  );
}

const CUES: { value: CueMode; label: string }[] = [
  { value: "tone", label: "음색 흔들기" },
  { value: "dip", label: "살짝 줄이기" },
  { value: "off", label: "끄기" },
];

/** `onWithdraw` takes back the location consent and leaves the public garden. */
export function SettingsCard({ settings, user, online, onChange, onLogin, onLogout, onWithdraw, onClose }: { settings: Settings; user: { name: string } | null; online: boolean; onChange: (settings: Settings) => void; onLogin: () => void; onLogout: () => void; onWithdraw: () => void; onClose: () => void }) {
  return (
    <Card title="설정">
      <Slider label="전체 음량" value={settings.volume} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(volume) => onChange({ ...settings, volume })} testID="settings-volume" />
      <View style={{ gap: 6 }}>
        <T size={12.5} tone="muted" weight="700">주변 채팅 알림</T>
        <Chips label="주변 채팅 알림" value={settings.cue} options={CUES} onChange={(cue) => onChange({ ...settings, cue })} />
        <T size={12} tone="muted">음색 흔들기는 음량과 저음을 그대로 두고 소리의 밝기만 잠깐 바꿉니다.</T>
      </View>
      {online && (
        <View style={{ gap: 6 }}>
          <T size={12.5} tone="muted" weight="700">계정</T>
          {user ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T size={14} style={{ flex: 1 }} lines={1}>{user.name}</T>
              <Btn small title="로그아웃" onPress={onLogout} testID="logout" />
            </View>
          ) : (
            <Btn small variant="mint" title="로그인" onPress={onLogin} testID="open-login" />
          )}
        </View>
      )}
      {online && <Btn small variant="danger" title="위치 동의 철회하고 나가기" onPress={onWithdraw} testID="withdraw-consent" />}
      <Btn title="닫기" onPress={onClose} />
    </Card>
  );
}
