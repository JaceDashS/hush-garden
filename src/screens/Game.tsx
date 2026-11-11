/**
 * The playable garden. `mode` "mine" is the private offline garden kept on the device; "public" is the shared
 * garden on the server, which needs location consent to enter and a login to chat.
 */
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HushClient } from "../api/client";
import { GardenSocket, socketUrl } from "../api/socket";
import { ApiError, type Entry, type RemotePlayer, type ServerMessage, type User } from "../api/types";
import { audibleCount, type GardenAudio } from "../audio/engine";
import { hidePlayback, onPlaybackButtons, showPlayback } from "../audio/session";
import { ConsentCard, LoginCard, PresetCard, SettingsCard } from "../components/Panels";
import { SpeakerEditor } from "../components/SpeakerEditor";
import { API_ORIGIN } from "../config";
import { BUBBLE_MS, CHAT_MAX_LENGTH, cleanMessage, cueFor } from "../domain/chat";
import { addSpeaker, applyPreset, deletePreset, moveSpeaker, removeSpeaker, resetGarden, savePreset, updateSpeaker, type MyGarden } from "../domain/garden";
import { MAX_SPEAKERS, type Speaker } from "../domain/sound";
import { GARDEN_SIZE, distance, keysToInput, step, type Point } from "../domain/world";
import { Scene, type Actor } from "../game/Scene";
import { requestCoordinates } from "../location";
import type { Settings } from "../settings";
import { Btn, Input, Modal, T, colors } from "../ui";

type Panel = null | "settings" | "presets" | "login";
type Link = "consent" | "entering" | "online" | "lost";

const SELECT_TILES = 1.1;
const SAVE_DELAY_MS = 400;
const RETRY_MS = 3000;
const BODIES = ["#cfe8ff", "#fff0b3", "#d9f5c5", "#e6d4ff", "#ffd9b8"];

const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const bodyFor = (id: string) => BODIES[[...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % BODIES.length];

const ENTER_ERRORS: Record<string, string> = {
  RATE_LIMITED: "잠시 후 다시 시도해 주세요.",
  GARDEN_FULL: "정원이 가득 찼습니다. 잠시 후 다시 시도해 주세요.",
};

export function Game({ mode, client, audio, settings, onSettings, garden, onGarden, onExit }: { mode: "mine" | "public"; client: HushClient; audio: GardenAudio; settings: Settings; onSettings: (settings: Settings) => void; garden: MyGarden; onGarden: (garden: MyGarden) => void; onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const online = mode === "public";

  const [me, setMe] = useState<Point>({ x: GARDEN_SIZE / 2, y: GARDEN_SIZE / 2 + 1 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [playing, setPlaying] = useState(audio.running);
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState("");

  const [link, setLink] = useState<Link>(online ? (settings.consent ? "entering" : "consent") : "online");
  const [enterError, setEnterError] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [publicSpeakers, setPublicSpeakers] = useState<Speaker[]>([]);
  const [others, setOthers] = useState<Record<string, RemotePlayer>>({});
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});
  const [draft, setDraft] = useState("");

  const speakers = online ? publicSpeakers : garden.speakers;
  const canEdit = online ? !!entry?.canEdit : true;
  const myId = useRef("me");
  const meRef = useRef(me);
  meRef.current = me;
  const joystick = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const socket = useRef<GardenSocket | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const targets = useRef<Record<string, Point>>({});
  const alive = useRef(true);

  const flash = useCallback((text: string) => {
    setNotice(text);
    setTimeout(() => alive.current && setNotice((current) => (current === text ? "" : current)), 3500);
  }, []);

  // --- sound -------------------------------------------------------------------------------------------------
  useEffect(() => audio.setSpeakers(speakers), [audio, speakers]);
  useEffect(() => audio.setListener(me), [audio, me]);
  useEffect(() => audio.setVolume(settings.volume), [audio, settings.volume]);

  const place = online ? entry?.place ?? "" : "내 정원";
  const togglePlay = useCallback(async () => {
    try {
      if (audio.running) {
        await audio.pause();
        setPlaying(false);
        void showPlayback(false, place);
      } else {
        await audio.start();
        setPlaying(true);
        void showPlayback(true, place);
      }
    } catch {
      flash("소리를 시작하지 못했습니다.");
    }
  }, [audio, flash, place]);

  useEffect(() => {
    if (playing) void showPlayback(true, place);
    return onPlaybackButtons(
      () => void audio.start().then(() => alive.current && setPlaying(true)),
      () => void audio.pause().then(() => alive.current && setPlaying(false)),
    );
    // The notification text follows the place name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, place]);

  useEffect(
    () => () => {
      alive.current = false;
      void hidePlayback();
    },
    [],
  );

  // --- movement ----------------------------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const typing = (event: KeyboardEvent) => ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement | null)?.tagName ?? "");
    const down = (event: KeyboardEvent) => {
      if (typing(event)) return;
      if (event.key.startsWith("Arrow")) event.preventDefault();
      keys.current.add(event.key);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = Date.now();
    let wasWalking = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = Date.now();
      const seconds = (now - last) / 1000;
      last = now;
      const stick = joystick.current;
      const input = stick.x || stick.y ? stick : keysToInput(keys.current);
      const active = Math.hypot(input.x, input.y) > 0.05;
      if (active !== wasWalking) {
        wasWalking = active;
        setWalking(active);
      }
      if (active) {
        const next = step(meRef.current, input, seconds);
        if (next.x !== meRef.current.x || next.y !== meRef.current.y) {
          meRef.current = next;
          setMe(next);
          socket.current?.move(next);
        }
        if (input.x > 0.1) setFacing(1);
        else if (input.x < -0.1) setFacing(-1);
      }
      // Other players glide toward their last reported position.
      const moves = targets.current;
      if (Object.keys(moves).length) {
        setOthers((current) => {
          let changed = false;
          const next = { ...current };
          for (const id of Object.keys(moves)) {
            const player = next[id];
            const target = moves[id];
            if (!player) {
              delete moves[id];
              continue;
            }
            const gap = distance(player, target);
            if (gap < 0.02) {
              delete moves[id];
              continue;
            }
            const ratio = Math.min(1, seconds * 10);
            next[id] = { ...player, x: player.x + (target.x - player.x) * ratio, y: player.y + (target.y - player.y) * ratio };
            changed = true;
          }
          return changed ? next : current;
        });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // --- public garden connection ------------------------------------------------------------------------------
  const receive = useCallback(
    (message: ServerMessage) => {
      switch (message.t) {
        case "hello": {
          myId.current = message.id;
          const start = { x: message.x, y: message.y };
          meRef.current = start;
          setMe(start);
          setPublicSpeakers(message.speakers);
          setOthers(Object.fromEntries(message.players.map((player) => [player.id, player])));
          targets.current = {};
          setLink("online");
          break;
        }
        case "join":
          setOthers((current) => ({ ...current, [message.player.id]: message.player }));
          break;
        case "leave":
          delete targets.current[message.id];
          setOthers((current) => {
            const next = { ...current };
            delete next[message.id];
            return next;
          });
          break;
        case "moves":
          for (const move of message.moves) if (move.id !== myId.current) targets.current[move.id] = { x: move.x, y: move.y };
          break;
        case "speakers":
          setPublicSpeakers(message.speakers);
          break;
        case "chat": {
          const mine = message.id === myId.current;
          setBubbles((current) => ({ ...current, [mine ? "me" : message.id]: { text: (mine ? "" : message.name + ": ") + message.text, until: Date.now() + BUBBLE_MS } }));
          if (!mine) {
            const cue = cueFor(meRef.current, message);
            if (cue) {
              audio.cue(cue, settingsRef.current.cue);
              if (Platform.OS !== "web" && settingsRef.current.cue !== "off") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            }
          }
          break;
        }
        case "error":
          flash(message.error === "CHAT_RATE_LIMITED" ? "조금 천천히 말해 주세요." : message.error === "LOGIN_REQUIRED" ? "채팅은 로그인이 필요합니다." : "요청을 처리하지 못했습니다.");
          break;
      }
    },
    [audio, flash],
  );

  const connect = useCallback(async () => {
    socket.current?.close();
    socket.current = null;
    setLink("entering");
    setEnterError("");
    try {
      const coordinates = await requestCoordinates();
      const result = await client.enter(coordinates);
      if (!alive.current) return;
      setEntry(result);
      const next = new GardenSocket(socketUrl(API_ORIGIN, result.ticket), receive, () => {
        if (!alive.current) return;
        socket.current = null;
        setLink("lost");
      });
      socket.current = next;
      next.open();
    } catch (cause) {
      if (!alive.current) return;
      setEnterError((cause instanceof ApiError && ENTER_ERRORS[cause.code]) || "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.");
      setLink(settingsRef.current.consent ? "lost" : "consent");
    }
  }, [client, receive]);

  useEffect(() => {
    if (online && settings.consent) void connect();
    return () => socket.current?.close();
    // Runs once per visit; reconnects are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (link !== "lost" || !online) return;
    const timer = setTimeout(() => void connect(), RETRY_MS);
    return () => clearTimeout(timer);
  }, [link, online, connect]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setBubbles((current) => {
        const kept = Object.entries(current).filter(([, bubble]) => bubble.until > now);
        return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- speaker editing ---------------------------------------------------------------------------------------
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pushPublic = useCallback(
    (speaker: Speaker) => {
      clearTimeout(saveTimers.current[speaker.id]);
      saveTimers.current[speaker.id] = setTimeout(() => {
        client.saveSpeaker(speaker).catch((cause) => flash(cause instanceof ApiError && cause.status === 403 ? "스피커를 바꿀 권한이 없습니다." : "스피커를 저장하지 못했습니다."));
      }, SAVE_DELAY_MS);
    },
    [client, flash],
  );

  const changeSpeakers = useCallback(
    (next: Speaker[], changedId?: string) => {
      if (!online) return onGarden({ ...garden, speakers: next });
      setPublicSpeakers(next);
      const changed = next.find((speaker) => speaker.id === changedId);
      if (changed) pushPublic(changed);
    },
    [online, onGarden, garden, pushPublic],
  );

  const selected = speakers.find((speaker) => speaker.id === selectedId) ?? null;

  const onTap = useCallback(
    (point: Point, speakerId: string | null) => {
      if (!editing || !canEdit) return;
      if (moving && selectedId) {
        setMoving(false);
        return changeSpeakers(moveSpeaker(speakers, selectedId, point), selectedId);
      }
      const near = speakers.map((speaker) => ({ speaker, gap: distance(speaker, point) })).filter((item) => item.gap < SELECT_TILES).sort((a, b) => a.gap - b.gap)[0];
      setSelectedId(speakerId ?? near?.speaker.id ?? null);
    },
    [editing, canEdit, moving, selectedId, speakers, changeSpeakers],
  );

  const addHere = () => {
    if (speakers.length >= MAX_SPEAKERS) return flash("스피커는 " + MAX_SPEAKERS + "개까지 놓을 수 있습니다.");
    const id = newId();
    changeSpeakers(addSpeaker(speakers, { x: me.x + 1, y: me.y }, id), id);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selected) return;
    const id = selected.id;
    setSelectedId(null);
    setMoving(false);
    if (!online) return onGarden({ ...garden, speakers: removeSpeaker(speakers, id) });
    setPublicSpeakers(removeSpeaker(speakers, id));
    clearTimeout(saveTimers.current[id]);
    client.deleteSpeaker(id).catch(() => flash("스피커를 지우지 못했습니다."));
  };

  // --- chat and account --------------------------------------------------------------------------------------
  const sendChat = () => {
    const text = cleanMessage(draft);
    if (!text) return;
    socket.current?.chat(text);
    setDraft("");
  };

  const afterLogin = async (_user: User) => {
    setPanel(null);
    await connect();
  };

  const logout = async () => {
    try {
      await client.logout();
      setPanel(null);
      await connect();
    } catch {
      flash("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const actors: Actor[] = useMemo(() => {
    const list: Actor[] = Object.values(others).map((player) => ({ id: player.id, x: player.x, y: player.y, label: player.place, bubble: bubbles[player.id]?.text, body: bodyFor(player.id) }));
    list.push({ id: "me", x: me.x, y: me.y, label: place || "…", bubble: bubbles.me?.text, facing, walking });
    return list;
  }, [others, bubbles, me, place, facing, walking]);

  const heard = audibleCount(me, speakers);
  const showEditor = editing && !!selected;

  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, flexDirection: wide ? "row" : "column" }}>
      <View style={{ flex: 1 }}>
        <Scene me={me} actors={actors} speakers={speakers} selectedId={editing ? selectedId : null} showRanges={editing} onInput={(input) => (joystick.current = input)} onTap={onTap} />

        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 10, gap: 6 }}>
          <View pointerEvents="box-none" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <Btn small title="나가기" onPress={onExit} testID="exit" />
            <Btn small variant={playing ? "mint" : "primary"} title={playing ? "소리 끄기" : "소리 켜기"} onPress={() => void togglePlay()} testID="toggle-sound" />
            {canEdit && (
              <Btn
                small
                variant={editing ? "mint" : "plain"}
                title={editing ? "편집 끝내기" : "스피커 편집"}
                onPress={() => {
                  setEditing(!editing);
                  setSelectedId(null);
                  setMoving(false);
                }}
                testID="toggle-edit"
              />
            )}
            {editing && <Btn small title="스피커 놓기" onPress={addHere} testID="add-speaker" />}
            {!online && <Btn small title="프리셋" onPress={() => setPanel("presets")} testID="open-presets" />}
            <Btn small title="설정" onPress={() => setPanel("settings")} testID="open-settings" />
          </View>
          <View pointerEvents="none" style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,250,242,0.9)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T size={12} weight="700" tone="muted">
              {(online ? "모두의 정원" + (link === "online" ? " · " + (Object.keys(others).length + 1) + "명" : "") : "내 정원 (오프라인)") + " · 들리는 스피커 " + heard + "개"}
            </T>
          </View>
          {!!notice && (
            <View pointerEvents="none" style={{ alignSelf: "flex-start", backgroundColor: colors.butter, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T size={12.5} weight="700">{notice}</T>
            </View>
          )}
          {online && link === "lost" && (
            <View pointerEvents="none" style={{ alignSelf: "flex-start", backgroundColor: colors.butter, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T size={12.5} weight="700">{enterError || "연결이 끊겼습니다. 다시 연결하는 중입니다."}</T>
            </View>
          )}
          {editing && !selected && (
            <View pointerEvents="none" style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,250,242,0.9)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <T size={12.5}>스피커를 눌러 소리를 바꾸거나, 스피커 놓기로 새로 놓으세요.</T>
            </View>
          )}
        </View>

        {online && link === "online" && !showEditor && (
          <View style={{ position: "absolute", left: 10, right: 10, bottom: insets.bottom + 10, flexDirection: "row", gap: 6, maxWidth: 520 }}>
            {entry?.canChat ? (
              <>
                <View style={{ flex: 1 }}>
                  <Input label="채팅" placeholder="주변 사람에게 말하기" value={draft} maxLength={CHAT_MAX_LENGTH} onChangeText={setDraft} onSubmit={sendChat} testID="chat-input" />
                </View>
                <Btn variant="primary" title="보내기" disabled={!draft.trim()} onPress={sendChat} testID="chat-send" />
              </>
            ) : (
              <Btn small variant="mint" title="로그인하고 채팅하기" onPress={() => setPanel("login")} testID="chat-login" />
            )}
          </View>
        )}
      </View>

      {showEditor && selected && (
        <View style={wide ? { width: 340, backgroundColor: colors.panel, borderLeftWidth: 2, borderLeftColor: colors.panelEdge, paddingTop: insets.top } : { height: "46%", backgroundColor: colors.panel, borderTopWidth: 2, borderTopColor: colors.panelEdge, paddingBottom: insets.bottom }}>
          <SpeakerEditor
            speaker={selected}
            moving={moving}
            onChange={(speaker) => changeSpeakers(updateSpeaker(speakers, speaker.id, { name: speaker.name, sound: speaker.sound }), speaker.id)}
            onMove={() => setMoving(!moving)}
            onDelete={removeSelected}
            onClose={() => {
              setSelectedId(null);
              setMoving(false);
            }}
          />
        </View>
      )}

      {online && (link === "consent" || link === "entering") && (
        <Modal>
          {link === "consent" ? (
            <ConsentCard
              busy={false}
              error={enterError}
              onCancel={onExit}
              onAgree={() => {
                onSettings({ ...settings, consent: true });
                settingsRef.current = { ...settings, consent: true };
                void connect();
              }}
            />
          ) : (
            <View style={{ backgroundColor: colors.panel, borderRadius: 24, borderWidth: 2, borderColor: colors.panelEdge, padding: 18, gap: 12 }}>
              <T size={16} weight="800">정원으로 들어가는 중…</T>
              <Btn title="돌아가기" onPress={onExit} />
            </View>
          )}
        </Modal>
      )}
      {panel === "settings" && (
        <Modal onClose={() => setPanel(null)}>
          <SettingsCard settings={settings} user={entry?.user ?? null} online={online} onChange={onSettings} onLogin={() => setPanel("login")} onLogout={() => void logout()}
            onWithdraw={() => {
              onSettings({ ...settings, consent: false });
              onExit();
            }}
            onClose={() => setPanel(null)}
          />
        </Modal>
      )}
      {panel === "login" && (
        <Modal onClose={() => setPanel(null)}>
          <LoginCard client={client} onLoggedIn={afterLogin} onClose={() => setPanel(null)} />
        </Modal>
      )}
      {panel === "presets" && (
        <Modal onClose={() => setPanel(null)}>
          <PresetCard
            garden={garden}
            onApply={(id) => {
              setSelectedId(null);
              onGarden(applyPreset(garden, id));
            }}
            onSave={(name) => onGarden(savePreset(garden, name, newId()))}
            onDelete={(id) => onGarden(deletePreset(garden, id))}
            onReset={() => {
              setSelectedId(null);
              onGarden(resetGarden());
            }}
            onClose={() => setPanel(null)}
          />
        </Modal>
      )}
    </View>
  );
}
