import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HushClient } from "./api/client";
import { createTransport } from "./api/transport";
import { GardenAudio } from "./audio/engine";
import { configureSession } from "./audio/session";
import { API_ORIGIN } from "./config";
import { initialGarden, type MyGarden } from "./domain/garden";
import { CHARACTER_KINDS, CHARACTER_NAMES, type CharacterKind } from "./domain/characters";
import { Character } from "./game/characters";
import { SpeakerArt } from "./game/sprites";
import { Game } from "./screens/Game";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { loadGarden, loadSettings, saveGarden, saveSettings } from "./storage";
import { Btn, Card, T, colors } from "./ui";

type Mode = "home" | "mine" | "public";

/** Title screen: choose the private offline garden or the shared public garden. */
function Home({ character, onCharacter, onPick }: { character: CharacterKind; onCharacter: (kind: CharacterKind) => void; onPick: (mode: "mine" | "public") => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <View style={{ width: "100%", maxWidth: 380, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
          <SpeakerArt color="brown" playing />
          <Character kind={character} walking />
          <SpeakerArt color="pink" playing />
        </View>
        <Card>
          <T size={30} weight="800" style={{ textAlign: "center" }}>Hush Garden</T>
          <T size={14} tone="muted" style={{ textAlign: "center" }}>스피커 가까이 걸어가면 소음이 포근하게 가려집니다.</T>
          <T size={12.5} tone="muted" weight="700">캐릭터 고르기</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {CHARACTER_KINDS.map((kind) => {
              const selected = kind === character;
              return (
                <Pressable key={kind} accessibilityRole="radio" accessibilityLabel={CHARACTER_NAMES[kind]} accessibilityState={{ selected }} testID={"character-" + kind} onPress={() => onCharacter(kind)} style={{ alignItems: "center", paddingHorizontal: 4, paddingTop: 4, paddingBottom: 2, borderRadius: 16, borderWidth: 2, borderColor: selected ? colors.mintDeep : "transparent", backgroundColor: selected ? "#e6f6ee" : "transparent" }}>
                  <Character kind={kind} />
                  <T size={11} weight="700" tone={selected ? "ink" : "muted"}>{CHARACTER_NAMES[kind]}</T>
                </Pressable>
              );
            })}
          </ScrollView>
          <Btn variant="primary" title="내 정원 (혼자, 오프라인)" onPress={() => onPick("mine")} testID="pick-mine" />
          <Btn variant="mint" title="모두의 정원 (온라인)" onPress={() => onPick("public")} testID="pick-public" />
          <T size={12} tone="muted" style={{ textAlign: "center" }}>방향키·WASD 또는 화면을 누른 채 끌어서 움직입니다.</T>
        </Card>
      </View>
    </View>
  );
}

export default function App() {
  const client = useMemo(() => new HushClient(createTransport(API_ORIGIN)), []);
  const audio = useRef(new GardenAudio()).current;
  const [mode, setMode] = useState<Mode>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [garden, setGarden] = useState<MyGarden>(initialGarden);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    configureSession();
    void Promise.all([loadSettings(), loadGarden()]).then(([storedSettings, storedGarden]) => {
      if (!active) return;
      setSettings(storedSettings);
      setGarden(storedGarden);
      setReady(true);
    });
    // A stored session is restored quietly; being signed out or offline is fine here.
    void client.restore().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client]);

  const changeSettings = (next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  };
  const changeGarden = (next: MyGarden) => {
    setGarden(next);
    void saveGarden(next);
  };

  /** Runs inside the button press, which browsers require before any sound may start. */
  const pick = (next: "mine" | "public") => {
    audio.setVolume(settings.volume);
    void audio.start().catch(() => undefined);
    setMode(next);
  };
  const exit = () => {
    void audio.pause().catch(() => undefined);
    setMode("home");
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!ready ? (
        <View style={{ flex: 1, backgroundColor: colors.sky }} />
      ) : mode === "home" ? (
        <Home character={settings.character} onCharacter={(character) => changeSettings({ ...settings, character })} onPick={pick} />
      ) : (
        <Game key={mode} mode={mode} client={client} audio={audio} settings={settings} onSettings={changeSettings} garden={garden} onGarden={changeGarden} onExit={exit} />
      )}
    </SafeAreaProvider>
  );
}
