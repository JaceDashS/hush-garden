import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HushClient } from "./api/client";
import { createTransport } from "./api/transport";
import { GardenAudio } from "./audio/engine";
import { configureSession } from "./audio/session";
import { API_ORIGIN } from "./config";
import { initialGarden, type MyGarden } from "./domain/garden";
import { Character, SpeakerArt } from "./game/sprites";
import { Game } from "./screens/Game";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { loadGarden, loadSettings, saveGarden, saveSettings } from "./storage";
import { Btn, Card, T, colors } from "./ui";

type Mode = "home" | "mine" | "public";

/** Title screen: choose the private offline garden or the shared public garden. */
function Home({ onPick }: { onPick: (mode: "mine" | "public") => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <View style={{ width: "100%", maxWidth: 380, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
          <SpeakerArt color="brown" playing />
          <Character />
          <SpeakerArt color="pink" playing />
        </View>
        <Card>
          <T size={30} weight="800" style={{ textAlign: "center" }}>Hush Garden</T>
          <T size={14} tone="muted" style={{ textAlign: "center" }}>스피커 가까이 걸어가면 소음이 포근하게 가려집니다.</T>
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
        <Home onPick={pick} />
      ) : (
        <Game key={mode} mode={mode} client={client} audio={audio} settings={settings} onSettings={changeSettings} garden={garden} onGarden={changeGarden} onExit={exit} />
      )}
    </SafeAreaProvider>
  );
}
