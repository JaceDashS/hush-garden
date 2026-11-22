import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HushClient } from "./api/client";
import { createTransport } from "./api/transport";
import type { RoomEntryResponse } from "./api/types";
import { GardenAudio } from "./audio/engine";
import { configureSession } from "./audio/session";
import { API_ORIGIN, TEST_GARDEN } from "./config";
import { initialGarden, type MyGarden } from "./domain/garden";
import type { CharacterKind } from "./domain/characters";
import type { SpeakerSound } from "./domain/sound";
import { removeSpeakerPreset, upsertSpeakerPreset } from "./domain/speakerPresets";
import { RoomLobby } from "./components/RoomLobby";
import { Character } from "./game/characters";
import { SpeakerArt } from "./game/sprites";
import { LanguageProvider, useT } from "./i18n";
import { Game } from "./screens/Game";
import { Toast } from "./components/Toast";
import { translate } from "./domain/text";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { loadGarden, loadSettings, loadTestGarden, saveGarden, saveSettings, saveTestGarden } from "./storage";
import { Btn, Card, Prepared, T, colors } from "./ui";

type Mode = "home" | "mine" | "lobby" | "room" | "test";

/** Title screen: choose the private offline garden or the online P2P room lobby; in development also the test garden. */
function Home({ character, onPick }: { character: CharacterKind; onPick: (mode: "mine" | "lobby" | "test") => void }) {
  const t = useT();
  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Prepared style={{ width: "100%", maxWidth: 380, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
          <SpeakerArt color="brown" playing />
          <Character kind={character} walking />
          <SpeakerArt color="pink" playing />
        </View>
        <Card>
          <T size={30} weight="800" style={{ textAlign: "center" }}>Hush Garden</T>
          <T size={14} tone="muted" style={{ textAlign: "center" }}>{t("home.tagline")}</T>
          <Btn variant="primary" title={t("home.mine")} onPress={() => onPick("mine")} testID="pick-mine" />
          <Btn variant="mint" title={t("home.public")} onPress={() => onPick("lobby")} testID="pick-public" />
          {TEST_GARDEN && <Btn title={t("home.test")} onPress={() => onPick("test")} testID="pick-test" />}
          <T size={12} tone="muted" style={{ textAlign: "center" }}>{t("home.controls")}</T>
        </Card>
      </Prepared>
    </View>
  );
}

const noticeLabel = (language: Settings["language"]) => translate(language, "notice.label");

const NO_SELECT_WEB = (Platform.OS === "web" ? { userSelect: "none", WebkitUserSelect: "none" } : null) as ViewStyle | null;

// Prevent drag-selection of UI text on the web while keeping text inputs selectable.
if (Platform.OS === "web" && typeof document !== "undefined" && !document.getElementById("hg-no-select")) {
  const style = document.createElement("style");
  style.id = "hg-no-select";
  style.textContent = "*,*::before,*::after{user-select:none!important;-webkit-user-select:none!important;}input,textarea{user-select:text!important;-webkit-user-select:text!important;}";
  document.head.appendChild(style);
  document.addEventListener("selectstart", (event) => {
    const el = event.target instanceof Element ? event.target : null;
    if (!el?.closest("input, textarea")) event.preventDefault();
  });
}

export default function App() {
  const client = useMemo(() => new HushClient(createTransport(API_ORIGIN)), []);
  const audio = useRef(new GardenAudio()).current;
  const [mode, setMode] = useState<Mode>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [garden, setGarden] = useState<MyGarden>(initialGarden);
  const [testGarden, setTestGarden] = useState<MyGarden>(initialGarden);
  const [activeRoom, setActiveRoom] = useState<RoomEntryResponse | null>(null);
  const [ready, setReady] = useState(false);

  const syncAccountData = useCallback(async () => {
    if (!client.currentUser) return;
    try {
      const [profile, presetRes] = await Promise.all([
        client.getProfile(),
        client.listSpeakerPresets(),
      ]);
      const next: Settings = {
        ...settingsRef.current,
        character: profile.character,
        customCharacter: profile.customCharacter ?? "",
        ...(profile.characterName ? { name: profile.characterName } : {}),
        speakerPresets: presetRes.presets,
      };
      settingsRef.current = next;
      setSettings(next);
      void saveSettings(next);
    } catch {
      // Quietly keep local settings when offline or unreachable.
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    configureSession();
    void Promise.all([loadSettings(), loadGarden(), TEST_GARDEN ? loadTestGarden() : Promise.resolve(initialGarden())]).then(([storedSettings, storedGarden, storedTest]) => {
      if (!active) return;
      settingsRef.current = storedSettings;
      setSettings(storedSettings);
      setGarden(storedGarden);
      setTestGarden(storedTest);
      setReady(true);
      void client.restore().then((user) => {
        if (active && user) void syncAccountData();
      }).catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [client, syncAccountData]);

  const changeSettings = (next: Settings) => {
    const prev = settingsRef.current;
    settingsRef.current = next;
    setSettings(next);
    void saveSettings(next);
    if (
      client.currentUser &&
      (next.character !== prev.character || next.customCharacter !== prev.customCharacter)
    ) {
      void client.saveProfile(next.character, next.customCharacter || null).catch(() => undefined);
    }
  };
  const changeGarden = (next: MyGarden) => {
    setGarden(next);
    void saveGarden(next);
  };
  const changeTestGarden = (next: MyGarden) => {
    setTestGarden(next);
    void saveTestGarden(next);
  };

  const handleSaveSpeakerPreset = async (name: string, sound: SpeakerSound) => {
    if (client.currentUser) {
      const res = await client.saveSpeakerPreset({ name, sound });
      const next = { ...settingsRef.current, speakerPresets: res.presets };
      settingsRef.current = next;
      setSettings(next);
      void saveSettings(next);
      return;
    }
    const id = "sp-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const nextPresets = upsertSpeakerPreset(settingsRef.current.speakerPresets, { id, name, sound });
    const next = { ...settingsRef.current, speakerPresets: nextPresets };
    settingsRef.current = next;
    setSettings(next);
    void saveSettings(next);
  };

  const handleDeleteSpeakerPreset = async (id: string) => {
    if (client.currentUser) {
      const res = await client.deleteSpeakerPreset(id);
      const next = { ...settingsRef.current, speakerPresets: res.presets };
      settingsRef.current = next;
      setSettings(next);
      void saveSettings(next);
      return;
    }
    const nextPresets = removeSpeakerPreset(settingsRef.current.speakerPresets, id);
    const next = { ...settingsRef.current, speakerPresets: nextPresets };
    settingsRef.current = next;
    setSettings(next);
    void saveSettings(next);
  };

  /** Runs inside the button press, which browsers require before any sound may start. */
  const pick = (next: "mine" | "lobby" | "test") => {
    if (next === "mine" || next === "test") {
      audio.setVolume(settings.volume);
      audio.setMono(settings.mono);
      void audio.start().catch(() => undefined);
    }
    setMode(next);
  };

  const enterRoom = (res: RoomEntryResponse) => {
    audio.setVolume(settings.volume);
    audio.setMono(settings.mono);
    void audio.start().catch(() => undefined);
    if (res.entry.user && (res.entry.character || res.entry.customCharacter !== undefined)) {
      const next: Settings = {
        ...settingsRef.current,
        ...(res.entry.character ? { character: res.entry.character } : {}),
        ...(res.entry.customCharacter !== undefined ? { customCharacter: res.entry.customCharacter ?? "" } : {}),
        ...(res.entry.characterName ? { name: res.entry.characterName } : {}),
      };
      settingsRef.current = next;
      setSettings(next);
      void saveSettings(next);
    }
    setActiveRoom(res);
    setMode("room");
  };

  const exit = () => {
    void audio.pause().catch(() => undefined);
    setActiveRoom(null);
    setMode(mode === "room" ? "lobby" : "home");
  };

  return (
    <SafeAreaProvider style={[{ flex: 1 }, NO_SELECT_WEB]}>
      <LanguageProvider language={settings.language}>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={{ flex: 1, backgroundColor: colors.sky }} />
      ) : mode === "home" ? (
        <Home character={settings.character} onPick={pick} />
      ) : mode === "lobby" ? (
        <RoomLobby
          client={client}
          settings={settings}
          onSettings={changeSettings}
          onEnterRoom={enterRoom}
          onSyncAccount={syncAccountData}
          onBack={() => setMode("home")}
        />
      ) : (
        <Game
          key={mode === "room" ? "room-" + (activeRoom?.room.id ?? "x") : mode}
          mode={mode}
          client={client}
          audio={audio}
          settings={settings}
          onSettings={changeSettings}
          garden={mode === "test" ? testGarden : garden}
          onGarden={mode === "test" ? changeTestGarden : changeGarden}
          initialRoom={mode === "room" ? activeRoom : null}
          onSyncAccount={syncAccountData}
          onSaveSpeakerPreset={handleSaveSpeakerPreset}
          onDeleteSpeakerPreset={handleDeleteSpeakerPreset}
          onExit={exit}
        />
      )}
      <Toast noticeLabel={noticeLabel(settings.language)} />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
