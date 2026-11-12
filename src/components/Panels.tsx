/** Cards shown over the garden: location consent, login, presets and settings. */
import React, { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import type { HushClient } from "../api/client";
import { ApiError, type User } from "../api/types";
import type { CueMode } from "../domain/chat";
import { BUILT_IN_PRESETS, MAX_PRESETS, type MyGarden } from "../domain/garden";
import { NAME_MAX_LENGTH, checkName } from "../domain/names";
import { LANGUAGES, LANGUAGE_NAMES, type TextKey } from "../domain/text";
import { useT } from "../i18n";
import type { Settings } from "../settings";
import { Btn, Card, Chips, DragLockContext, Input, Slider, T, colors } from "../ui";
import { CharacterPicker } from "./CharacterPicker";
import { GoogleButton } from "./GoogleButton";

/** Explains what location is used for before the public garden opens. Nothing is requested until the user agrees. */
export function ConsentCard({ busy, error, onAgree, onCancel }: { busy: boolean; error: string; onAgree: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <Card title={t("consent.title")}>
      <T size={14}>{t("consent.intro")}</T>
      <View style={{ gap: 4 }}>
        <T size={13} tone="muted">{t("consent.device")}</T>
        <T size={13} tone="muted">{t("consent.rounded")}</T>
        <T size={13} tone="muted">{t("consent.shown")}</T>
        <T size={13} tone="muted">{t("consent.chat")}</T>
      </View>
      {!!error && <T size={13} tone="danger">{error}</T>}
      <Btn variant="primary" title={t(busy ? "consent.busy" : "consent.agree")} disabled={busy} onPress={onAgree} testID="consent-agree" />
      <Btn title={t("common.back")} disabled={busy} onPress={onCancel} testID="consent-cancel" />
    </Card>
  );
}

const LOGIN_ERRORS: Record<string, TextKey> = {
  INVALID_CREDENTIALS: "login.invalid",
  EMAIL_NOT_VERIFIED: "login.unverified",
  RATE_LIMITED: "login.rateLimited",
};

/** jace-s account login. Chat needs it; walking and listening do not. */
export function LoginCard({ client, onLoggedIn, onClose }: { client: HushClient; onLoggedIn: (user: User) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TextKey | "">("");
  const submit = async () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await onLoggedIn(await client.login(username, password, remember));
    } catch (cause) {
      setError((cause instanceof ApiError && LOGIN_ERRORS[cause.code]) || "login.failed");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };
  return (
    <Card title={t("login.title")}>
      <T size={13} tone="muted">{t("login.intro")}</T>
      <GoogleButton client={client} remember={remember} disabled={busy} onBusyChange={setBusy} onLoggedIn={onLoggedIn} />
      <Input label={t("login.username")} placeholder={t("login.username")} value={username} onChangeText={setUsername} testID="login-username" />
      <Input label={t("login.password")} placeholder={t("login.password")} value={password} onChangeText={setPassword} secure onSubmit={() => void submit()} testID="login-password" />
      {Platform.OS === "web" && (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} accessibilityLabel={t("login.remember")} onPress={() => setRemember(!remember)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: remember ? colors.mintDeep : colors.panelEdge, backgroundColor: remember ? colors.mint : colors.white }} />
          <T size={13} tone="muted">{t("login.remember")}</T>
        </Pressable>
      )}
      {!!error && <T size={13} tone="danger">{t(error)}</T>}
      <Btn variant="primary" title={t(busy ? "login.busy" : "login.submit")} disabled={busy || !username.trim() || !password} onPress={() => void submit()} testID="login-submit" />
      <Btn title={t("common.close")} onPress={onClose} />
    </Card>
  );
}

/** Private garden presets: apply a built-in or saved layout, save the current one, delete, or reset everything. */
export function PresetCard({ garden, onApply, onSave, onDelete, onReset, onClose }: { garden: MyGarden; onApply: (id: string) => void; onSave: (name: string) => void; onDelete: (id: string) => void; onReset: () => void; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Card title={t("preset.title")}>
      <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 8 }}>
        <T size={12.5} tone="muted" weight="700">{t("preset.builtIn")}</T>
        {BUILT_IN_PRESETS.map((preset) => (
          <Btn key={preset.id} small title={t("preset.load", { name: preset.name })} onPress={() => onApply(preset.id)} testID={"preset-" + preset.id} />
        ))}
        <T size={12.5} tone="muted" weight="700">{t("preset.mine")}</T>
        {garden.presets.length === 0 && <T size={13} tone="muted">{t("preset.none")}</T>}
        {garden.presets.map((preset) => (
          <View key={preset.id} style={{ flexDirection: "row", gap: 6 }}>
            <Btn small title={t("preset.load", { name: preset.name })} onPress={() => onApply(preset.id)} style={{ flex: 1 }} />
            <Btn small variant="danger" title={t("common.delete")} onPress={() => onDelete(preset.id)} />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Input label={t("preset.newName")} placeholder={t("preset.newName")} value={name} maxLength={24} onChangeText={setName} testID="preset-name" />
        </View>
        <Btn
          variant="mint"
          title={t("common.save")}
          disabled={!name.trim() || garden.presets.length >= MAX_PRESETS}
          onPress={() => {
            onSave(name);
            setName("");
          }}
          testID="preset-save"
        />
      </View>
      <T size={12} tone="muted">{t("preset.help")}</T>
      {confirmReset ? (
        <View style={{ gap: 6 }}>
          <T size={13} tone="danger">{t("preset.resetWarning")}</T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Btn small variant="danger" title={t("preset.reset")} onPress={() => { setConfirmReset(false); onReset(); }} testID="preset-reset-confirm" />
            <Btn small title={t("common.cancel")} onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      ) : (
        <Btn small variant="danger" title={t("preset.resetAll")} onPress={() => setConfirmReset(true)} testID="preset-reset" />
      )}
      <Btn title={t("common.close")} onPress={onClose} />
    </Card>
  );
}

const CUES: readonly CueMode[] = ["tone", "dip", "off"];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T size={12.5} tone="muted" weight="700">{title}</T>
      {children}
    </View>
  );
}

/**
 * Everything that is not handling a speaker lives here: sound on and off, volume, character, language, character name, chat
 * cue, presets, account and leaving the garden. `shownName` is the name currently above the character. `onName`
 * receives a checked name, or "" to go back to the account name; `nameError` is the server's refusal, if any.
 * `open` is false while the card is kept prepared but not shown.
 */
export function SettingsCard({ open = true, settings, user, online, playing, shownName, nameError, onChange, onName, onToggleSound, onPresets, onLogin, onLogout, onExit, onClose }: { settings: Settings; user: { name: string } | null; online: boolean; playing: boolean; shownName: string; nameError: string; onChange: (settings: Settings) => void; onName: (name: string) => void; onToggleSound: () => void; onPresets: () => void; onLogin: () => void; onLogout: () => void; onExit: () => void; onClose: () => void; open?: boolean }) {
  const t = useT();
  const [name, setName] = useState(settings.name);
  // The card is prepared before it is opened, so each opening starts from the saved name with no error shown.
  useEffect(() => {
    if (!open) return;
    setName(settings.name);
    setProblem("");
  }, [open]);
  const [problem, setProblem] = useState<TextKey | "">("");
  const [dragging, setDragging] = useState(false);
  const saveName = () => {
    if (!name.trim()) {
      setProblem("");
      return onName("");
    }
    const check = checkName(name);
    if (!check.ok) return setProblem(("name." + check.problem) as TextKey);
    setProblem("");
    setName(check.name);
    onName(check.name);
  };
  return (
    <Card title={t("settings.title")} style={{ maxHeight: "100%" }}>
      <DragLockContext.Provider value={setDragging}>
        <ScrollView scrollEnabled={!dragging} style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
          <Group title={t("settings.sound")}>
            <Btn variant={playing ? "mint" : "primary"} title={t(playing ? "settings.soundOff" : "settings.soundOn")} onPress={onToggleSound} testID="toggle-sound" />
            <Slider label={t("settings.volume")} value={settings.volume} min={0} max={1} format={(v) => Math.round(v * 100) + "%"} onChange={(volume) => onChange({ ...settings, volume })} testID="settings-volume" />
          </Group>
          <Group title={t("settings.character")}>
            <CharacterPicker value={settings.character} onChange={(character) => onChange({ ...settings, character })} />
          </Group>
          <Group title={t("settings.language")}>
            <Chips label={t("settings.language")} value={settings.language} options={LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAMES[language] }))} onChange={(language) => onChange({ ...settings, language })} />
          </Group>
          <Group title={t("settings.nameNow", { name: shownName })}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={{ flex: 1 }}>
                <Input label={t("settings.name")} placeholder={t("settings.namePlaceholder")} value={name} maxLength={NAME_MAX_LENGTH} onChangeText={setName} onSubmit={saveName} testID="settings-name" />
              </View>
              <Btn variant="mint" title={t("settings.nameSave")} onPress={saveName} testID="settings-name-save" />
            </View>
            {!!(problem || nameError) && <T size={12.5} tone="danger">{problem ? t(problem, { n: NAME_MAX_LENGTH }) : nameError}</T>}
          </Group>
          <Group title={t("settings.cue")}>
            <Chips label={t("settings.cue")} value={settings.cue} options={CUES.map((cue) => ({ value: cue, label: t(("cue." + cue) as TextKey) }))} onChange={(cue) => onChange({ ...settings, cue })} />
            <T size={12} tone="muted">{t("settings.cueHelp")}</T>
          </Group>
          {online && (
            <Group title={t("settings.account")}>
              {user ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <T size={14} style={{ flex: 1 }} lines={1}>{user.name}</T>
                  <Btn small title={t("settings.logout")} onPress={onLogout} testID="logout" />
                </View>
              ) : (
                <Btn small variant="mint" title={t("login.submit")} onPress={onLogin} testID="open-login" />
              )}
            </Group>
          )}
          <Group title={t("settings.garden")}>
            {!online && <Btn small title={t("settings.presets")} onPress={onPresets} testID="open-presets" />}
            <Btn small variant="danger" title={t("settings.exit")} onPress={onExit} testID="exit" />
          </Group>
        </ScrollView>
      </DragLockContext.Provider>
      <Btn title={t("common.close")} onPress={onClose} testID="settings-close" />
    </Card>
  );
}
