/**
 * The playable garden.
 * - `mine` / `test`: private offline garden kept on the device.
 * - `room`: P2P full-mesh online room coordinated by the room signaling socket.
 * - `public`: legacy server-relayed public garden (kept for compatibility).
 */
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, View, useWindowDimensions, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HushClient } from "../api/client";
import { MeshPeerManager, type MeshDataMessage } from "../api/meshPeer";
import { KICKED_CODE as ROOM_KICKED_CODE, REPLACED_CODE as ROOM_REPLACED_CODE, RoomSocket, roomSocketUrl } from "../api/roomSocket";
import { GardenSocket, REPLACED_CODE, socketUrl } from "../api/socket";
import { getDeviceId } from "../deviceId";
import {
  ApiError,
  type Entry,
  type RemotePlayer,
  type RoomDetail,
  type RoomEntryResponse,
  type RoomMember,
  type RoomServerMessage,
  type ServerMessage,
  type User,
} from "../api/types";
import type { GardenAudio } from "../audio/engine";
import { onFloatingBubbleEvents, syncFloatingBubblePlaying } from "../audio/floatingBubble";
import { hidePlayback, onPlaybackButtons, showPlayback } from "../audio/session";
import { MyCharacters } from "../components/MyCharacters";
import { AdBanner } from "../components/AdBanner";
import { ChatLog } from "../components/ChatLog";
import { ConsentCard, LoginCard, NatureDownloadCard, PresetCard, SettingsCard } from "../components/Panels";
import { countryFlag } from "../components/RoomLobby";
import { RoomPanel } from "../components/RoomPanel";
import { dismissToast, showMessage, showToast } from "../toasts";
import { loadNotices, showNotices } from "../api/notices";
import { GardenStatus } from "../components/GardenStatus";
import { SOUND_KEY_CODE, SoundButton } from "../components/SoundButton";
import { SpeakerEditor } from "../components/SpeakerEditor";
import { clearPatch, startPatch, usePatchState } from "../audio/patchSession";
import { API_ORIGIN } from "../config";
import { actionDuration, actionKindOf, liftTravel, type ActionName, type GroundSpot } from "../domain/actions";
import { PICK_UP_TILES, resolveChatColor } from "../domain/characters";
import { BUBBLE_MS, CHAT_MAX_LENGTH, CHAT_RANGE, appendChatEntry, cleanMessage, cueFor, type ChatEntry } from "../domain/chat";
import { addSpeaker, applyPreset, deletePreset, moveSpeaker, removeSpeaker, resetGarden, savePreset, updateSpeaker, type MyGarden } from "../domain/garden";
import { MAX_SPEAKERS, audibleCount, defaultSound, lookOf, type SourceLook, type Speaker, type SpeakerSound } from "../domain/sound";
import { MAX_STAMINA, RUN_SPEED, initialStaminaState, stepStamina, type StaminaState } from "../domain/stamina";
import type { TextKey } from "../domain/text";
import { GARDEN_SIZE, TILE_WIDTH, WALK_SPEED, clampToGarden, distance, keysToInput, step, toGarden, toScreen, type Point } from "../domain/world";
import { Scene, groundSpotFor, type Actor, type ChatRipple, type Marker } from "../game/Scene";
import { useT } from "../i18n";
import { requestCoordinates } from "../location";
import { sendNearbyChatNotification } from "../notifications";
import type { Settings } from "../settings";
import { Btn, GearIcon, IconBtn, Input, Modal, T, colors } from "../ui";

type Panel = null | "settings" | "presets" | "login" | "room";
type Link = "consent" | "entering" | "online" | "lost" | "replaced";

const SAVE_DELAY_MS = 350;
const RETRY_MS = 3000;
const BONK_RANGE = 2.5;
const BONK_COOLDOWN_MS = 1500;
const BONK_DURATION_MS = 420;
const CHAT_COOLDOWN_MS = 900;

const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ENTER_ERRORS: Record<string, TextKey> = {
  RATE_LIMITED: "notice.rateLimited",
  GARDEN_FULL: "notice.gardenFull",
  ROOM_NOT_FOUND: "lobby.roomNotFound",
  ROOM_FULL: "lobby.roomFull",
  BANNED: "lobby.banned",
};
const NAME_ERRORS: Record<string, TextKey> = {
  NAME_NOT_ALLOWED: "name.notAllowed",
  NAME_SAVE_FAILED: "name.saveFailed",
  NAME_RATE_LIMITED: "name.rateLimited",
};

export function Game({
  mode,
  client,
  audio,
  settings,
  onSettings,
  garden,
  onGarden,
  initialRoom = null,
  onSyncAccount,
  onSaveSpeakerPreset,
  onDeleteSpeakerPreset,
  onExit,
}: {
  mode: "mine" | "public" | "room" | "test";
  client: HushClient;
  audio: GardenAudio;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  garden: MyGarden;
  onGarden: (garden: MyGarden) => void;
  initialRoom?: RoomEntryResponse | null;
  onSyncAccount?: () => Promise<void>;
  onSaveSpeakerPreset?: (name: string, sound: SpeakerSound) => Promise<void>;
  onDeleteSpeakerPreset?: (id: string) => Promise<void>;
  onExit: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const isRoom = mode === "room";
  const online = mode === "public" || isRoom;

  const [me, setMe] = useState<Point>(() => ({
    x: GARDEN_SIZE / 2 + (Math.random() - 0.5) * 2,
    y: GARDEN_SIZE / 2 + 1 + (Math.random() - 0.5) * 2,
  }));
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [playing, setPlaying] = useState(audio.running);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    setPlaying(audio.running);
    return audio.subscribe(setPlaying);
  }, [audio]);

  const [panel, setPanel] = useState<Panel>(null);
  const panelRef = useRef<Panel>(null);
  panelRef.current = panel;
  const [carryId, setCarryId] = useState<string | null>(null);
  const [action, setAction] = useState<(Actor["action"] & { spot?: Point }) | undefined>(undefined);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!action?.spot) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 33);
    return () => clearInterval(timer);
  }, [action]);
  const [editing, setEditing] = useState(false);
  const [nameError, setNameError] = useState<TextKey | "">("");

  const [link, setLink] = useState<Link>(
    online ? (isRoom ? "entering" : settings.consent ? "entering" : "consent") : "online",
  );
  const linkRef = useRef<Link>(link);
  linkRef.current = link;
  const [enterError, setEnterError] = useState<TextKey | "">("");
  const [entry, setEntry] = useState<Entry | null>(initialRoom?.entry ?? null);
  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(initialRoom?.room ?? null);
  const roomDetailRef = useRef<RoomDetail | null>(roomDetail);
  roomDetailRef.current = roomDetail;
  const [roomMembers, setRoomMembers] = useState<Record<string, RoomMember>>({});
  const myJoinedAt = useRef(Date.now());
  const pendingInitialRoom = useRef<RoomEntryResponse | null>(initialRoom);

  const [publicSpeakers, setPublicSpeakers] = useState<Speaker[]>([]);
  const [others, setOthers] = useState<Record<string, RemotePlayer>>({});
  const [motion, setMotion] = useState<Record<string, { facing: 1 | -1; walking: boolean }>>({});
  const [remoteActions, setRemoteActions] = useState<Record<string, Actor["action"]>>({});
  const [bonks, setBonks] = useState<Record<string, { role: "swing" | "hit"; startedAt: number }>>({});
  const bonkTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const remoteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingHold = useRef<Speaker | null>(null);
  const othersRef = useRef(others);
  othersRef.current = others;
  const motionRef = useRef(motion);
  motionRef.current = motion;
  const facingRef = useRef(facing);
  facingRef.current = facing;
  const carryIdRef = useRef(carryId);
  carryIdRef.current = carryId;
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});
  const [chatRipples, setChatRipples] = useState<ChatRipple[]>([]);
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const nextChatId = useRef(0);
  const lastChatSentAt = useRef(0);
  const lastBonkAt = useRef(0);
  const [draft, setDraft] = useState("");
  const chatInput = useRef<React.ComponentRef<typeof TextInput>>(null);

  const staminaRef = useRef<StaminaState>(initialStaminaState());
  const [staminaUi, setStaminaUi] = useState<{ value: number; exhausted: boolean }>({
    value: MAX_STAMINA,
    exhausted: false,
  });
  const staminaUiRef = useRef(staminaUi);
  staminaUiRef.current = staminaUi;
  const touchSprint = useRef(false);
  const [sprintDown, setSprintDown] = useState(false);

  const placed = online ? publicSpeakers : garden.speakers;
  const carriedAt = useMemo((): Point => {
    if (!action?.spot || (action.name !== "lift" && action.name !== "putDown")) return me;
    const travel = liftTravel(actionKindOf(settings.character, settings.customCharacter), action.name, clock - action.startedAt);
    return { x: action.spot.x + (me.x - action.spot.x) * travel, y: action.spot.y + (me.y - action.spot.y) * travel };
  }, [action, clock, me, settings.character, settings.customCharacter]);
  const heldByOther = useMemo(() => {
    const map = new Map<string, RemotePlayer>();
    for (const player of Object.values(others)) {
      if (player.carrying) map.set(player.carrying, player);
    }
    return map;
  }, [others]);
  const heldIds = useMemo(() => {
    const set = new Set<string>(heldByOther.keys());
    if (carryId) set.add(carryId);
    return set;
  }, [heldByOther, carryId]);
  const speakers = useMemo(() => {
    if (!carryId && heldByOther.size === 0) return placed;
    return placed.map((speaker) => {
      if (speaker.id === carryId) return { ...speaker, x: carriedAt.x, y: carriedAt.y };
      const holder = heldByOther.get(speaker.id);
      return holder ? { ...speaker, x: holder.x, y: holder.y } : speaker;
    });
  }, [placed, carryId, carriedAt, heldByOther]);
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  const acting = useRef(false);
  const myId = useRef("me");
  const canEdit = isRoom
    ? !!roomDetail && (roomDetail.hostPeerId === myId.current || roomDetail.allowGuestEdit)
    : online
      ? !!entry?.canEdit
      : true;
  const meRef = useRef(me);
  meRef.current = me;
  const joystick = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const socket = useRef<GardenSocket | null>(null);
  const roomSocket = useRef<RoomSocket | null>(null);
  const mesh = useRef<MeshPeerManager | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSettingsRef = useRef(onSettings);
  onSettingsRef.current = onSettings;
  const targets = useRef<Record<string, Point>>({});
  const alive = useRef(true);

  const flash = useCallback((key: TextKey, values?: Record<string, string | number>) => showMessage(t(key, values)), [t]);

  // --- sound -------------------------------------------------------------------------------------------------
  useEffect(() => audio.setSpeakers(speakers), [audio, speakers]);
  const [askNature, setAskNature] = useState<{ bytes: number; answer: (yes: boolean) => void } | null>(null);
  const askDownload = useCallback((bytes: number) => {
    const choice = settingsRef.current.natureSounds;
    if (choice !== "ask") return Promise.resolve(choice === "yes");
    return new Promise<boolean>((answer) => setAskNature({ bytes, answer }));
  }, []);
  useEffect(() => startPatch(audio, askDownload), [audio, askDownload]);
  useEffect(() => void loadNotices(), []);
  const patch = usePatchState();
  const natureLock = patch?.phase === "ready" ? null : patch?.phase === "failed" ? "failed" : patch?.phase === "declined" ? "declined" : "loading";
  const answerNature = (yes: boolean, dontAsk = false) => {
    const next = yes ? "yes" : dontAsk ? "no" : settingsRef.current.natureSounds;
    if (next !== settingsRef.current.natureSounds) {
      settingsRef.current = { ...settingsRef.current, natureSounds: next };
      onSettings(settingsRef.current);
    }
    askNature?.answer(yes);
    setAskNature(null);
  };
  const downloadNature = () => {
    settingsRef.current = { ...settingsRef.current, natureSounds: "yes" };
    onSettings(settingsRef.current);
    startPatch(audio, async () => true, true);
  };
  const developer = {
    redownload: () => {
      settingsRef.current = { ...settingsRef.current, natureSounds: "ask" };
      onSettings(settingsRef.current);
      void clearPatch(audio).then(() => startPatch(audio, askDownload, true));
    },
    notice: () => {
      setPanel(null);
      showNotices([{ id: "dev-" + Date.now(), title: t("dev.sampleNotice") }], true);
    },
    notices: () => {
      setPanel(null);
      void loadNotices(true);
    },
    flash: () => {
      setPanel(null);
      flash("dev.sampleFlash");
    },
  };
  useEffect(() => audio.setListener(me), [audio, me]);
  useEffect(() => audio.setVolume(settings.volume), [audio, settings.volume]);
  useEffect(() => audio.setMono(settings.mono), [audio, settings.mono]);

  // Sync muted (earmuffs) status to room peers whenever playback state changes.
  useEffect(() => {
    if (isRoom && link === "online") {
      roomSocket.current?.mute(!playing);
    }
  }, [isRoom, link, playing]);

  // Sync appearance changes in room mode immediately.
  useEffect(() => {
    if (isRoom && link === "online") {
      roomSocket.current?.look(settings.character, settings.customCharacter || null);
    }
  }, [isRoom, link, settings.character, settings.customCharacter]);

  const place = online ? entry?.place ?? "" : t("status.mine");
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
      flash("notice.soundFailed");
    }
  }, [audio, flash, place]);
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    syncFloatingBubblePlaying(playing);
  }, [playing]);

  useEffect(() => {
    return onFloatingBubbleEvents(() => void togglePlayRef.current(), () => undefined);
  }, []);

  useEffect(() => {
    if (playing) void showPlayback(true, place);
    return onPlaybackButtons(
      () => void audio.start().then(() => alive.current && setPlaying(true)),
      () => void audio.pause().then(() => alive.current && setPlaying(false)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, place]);

  useEffect(
    () => () => {
      alive.current = false;
      void hidePlayback();
    },
    [],
  );

  // --- movement + sprint stamina ---------------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const typing = (event: KeyboardEvent) => ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement | null)?.tagName ?? "");
    const down = (event: KeyboardEvent) => {
      if (linkRef.current === "replaced") return;
      if (event.key === "Escape" && !event.repeat) {
        event.preventDefault();
        setPanel((open) => (open ? null : typing(event) ? open : "settings"));
        return;
      }
      if (event.key === "Enter" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (typing(event)) return;
        if (!panelRef.current && chatInput.current) {
          event.preventDefault();
          keys.current.clear();
          chatInput.current.focus();
        }
        return;
      }
      if (typing(event)) return;
      if (event.code === SOUND_KEY_CODE && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void togglePlayRef.current();
        return;
      }
      if (event.key.startsWith("Arrow")) event.preventDefault();
      keys.current.add(event.key);
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.key);
    };
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
      const input = acting.current ? { x: 0, y: 0 } : stick.x || stick.y ? stick : keysToInput(keys.current);
      const active = Math.hypot(input.x, input.y) > 0.05;
      if (active !== wasWalking) {
        wasWalking = active;
        setWalking(active);
      }

      const wantsSprint = keys.current.has("Shift") || touchSprint.current;
      const nextStamina = stepStamina(staminaRef.current, wantsSprint, active, seconds, now);
      staminaRef.current = nextStamina;
      if (
        Math.round(nextStamina.stamina) !== Math.round(staminaUiRef.current.value) ||
        nextStamina.exhausted !== staminaUiRef.current.exhausted
      ) {
        const ui = { value: nextStamina.stamina, exhausted: nextStamina.exhausted };
        staminaUiRef.current = ui;
        setStaminaUi(ui);
      }

      if (active) {
        const speed = nextStamina.sprinting ? RUN_SPEED : WALK_SPEED;
        const next = step(meRef.current, input, seconds, speed);
        if (next.x !== meRef.current.x || next.y !== meRef.current.y) {
          meRef.current = next;
          setMe(next);
          if (isRoom) mesh.current?.move(next);
          else socket.current?.move(next);
        }
        if (input.x > 0.1) setFacing(1);
        else if (input.x < -0.1) setFacing(-1);
      }

      const moves = targets.current;
      if (Object.keys(moves).length) {
        setOthers((current) => {
          let changed = false;
          const next = { ...current };
          const arrived: string[] = [];
          const walkers: Record<string, 1 | -1 | 0> = {};
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
              arrived.push(id);
              continue;
            }
            const side = target.x - player.x - (target.y - player.y);
            walkers[id] = side > 0.02 ? 1 : side < -0.02 ? -1 : 0;
            const ratio = Math.min(1, seconds * 10);
            next[id] = { ...player, x: player.x + (target.x - player.x) * ratio, y: player.y + (target.y - player.y) * ratio };
            changed = true;
          }
          if (arrived.length || Object.keys(walkers).length) {
            setMotion((before) => {
              let moved = false;
              const after = { ...before };
              for (const id of arrived) {
                if (after[id]?.walking) {
                  after[id] = { ...after[id], walking: false };
                  moved = true;
                }
              }
              for (const id of Object.keys(walkers)) {
                const side = walkers[id] || after[id]?.facing || 1;
                if (!after[id]?.walking || after[id].facing !== side) {
                  after[id] = { facing: side, walking: true };
                  moved = true;
                }
              }
              return moved ? after : before;
            });
          }
          return changed ? next : current;
        });
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isRoom]);

  const playRemote = useCallback((playerId: string, kind: ReturnType<typeof actionKindOf>, name: ActionName, look: SourceLook, ground?: GroundSpot) => {
    clearTimeout(remoteTimers.current[playerId]);
    setRemoteActions((current) => ({ ...current, [playerId]: { name, startedAt: Date.now(), look, ground } }));
    remoteTimers.current[playerId] = setTimeout(() => {
      delete remoteTimers.current[playerId];
      if (!alive.current) return;
      setRemoteActions((current) => {
        if (!current[playerId]) return current;
        const next = { ...current };
        delete next[playerId];
        return next;
      });
    }, actionDuration(kind, name));
  }, []);

  const triggerBonkEffect = useCallback((actorKey: string, role: "swing" | "hit") => {
    clearTimeout(bonkTimers.current[actorKey]);
    setBonks((current) => ({ ...current, [actorKey]: { role, startedAt: Date.now() } }));
    bonkTimers.current[actorKey] = setTimeout(() => {
      delete bonkTimers.current[actorKey];
      if (!alive.current) return;
      setBonks((current) => {
        if (!current[actorKey]) return current;
        const next = { ...current };
        delete next[actorKey];
        return next;
      });
    }, BONK_DURATION_MS);
  }, []);

  const receiveChat = useCallback(
    (payload: { senderId: string; name: string; text: string; color?: string; x: number; y: number }) => {
      const mine = payload.senderId === myId.current;
      const at = Date.now();
      nextChatId.current += 1;
      const rippleId = `${at}-${nextChatId.current}`;
      const rippleColor = mine
        ? resolveChatColor(settingsRef.current.character, settingsRef.current.chatColor)
        : payload.color || resolveChatColor(othersRef.current[payload.senderId]?.character ?? "bunny");
      const rippleAt = mine ? meRef.current : othersRef.current[payload.senderId] ?? { x: payload.x, y: payload.y };
      if (mine || playingRef.current) {
        setChatRipples((current) => [...current, { id: rippleId, x: rippleAt.x, y: rippleAt.y, color: rippleColor }]);
        setTimeout(() => {
          if (!alive.current) return;
          setChatRipples((current) => current.filter((item) => item.id !== rippleId));
        }, 1850);
        setBubbles((current) => ({
          ...current,
          [mine ? "me" : payload.senderId]: { text: (mine ? "" : payload.name + ": ") + payload.text, until: at + BUBBLE_MS },
        }));
      }
      // Always record nearby chat in the log even while wearing earmuffs (AFK mode).
      setChatLog((current) =>
        appendChatEntry(current, { id: rippleId, senderId: payload.senderId, name: payload.name, text: payload.text, at, mine }),
      );
      if (!mine && playingRef.current) {
        const cue = cueFor(meRef.current, { x: payload.x, y: payload.y });
        if (cue) {
          audio.cue(cue, settingsRef.current.cue);
          if (Platform.OS !== "web" && settingsRef.current.cue !== "off") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          }
        }
        if (settingsRef.current.chatNotifications) {
          void sendNearbyChatNotification(payload.name, payload.text);
        }
      }
    },
    [audio],
  );

  // --- P2P Room Mode -----------------------------------------------------------------------------------------
  const handleMeshMessage = useCallback(
    (fromPeerId: string, message: MeshDataMessage) => {
      switch (message.t) {
        case "helloPos": {
          delete targets.current[fromPeerId];
          setOthers((current) =>
            current[fromPeerId] ? { ...current, [fromPeerId]: { ...current[fromPeerId], x: message.x, y: message.y } } : current,
          );
          break;
        }
        case "move": {
          targets.current[fromPeerId] = { x: message.x, y: message.y };
          break;
        }
        case "action": {
          const other = othersRef.current[fromPeerId];
          if (other) playRemote(fromPeerId, actionKindOf(other.character, other.custom), message.name, message.look);
          break;
        }
        case "chat": {
          const sender = othersRef.current[fromPeerId];
          const senderAt = sender ? { x: sender.x, y: sender.y } : { x: message.x, y: message.y };
          if (distance(meRef.current, senderAt) > CHAT_RANGE) return;
          receiveChat({
            senderId: fromPeerId,
            name: sender?.name || "?",
            text: message.text,
            color: message.color,
            x: senderAt.x,
            y: senderAt.y,
          });
          break;
        }
        case "bonk": {
          if (!roomDetailRef.current?.allowInteraction) return;
          triggerBonkEffect(fromPeerId, "swing");
          triggerBonkEffect(message.targetId === myId.current ? "me" : message.targetId, "hit");
          const sender = othersRef.current[fromPeerId];
          const at = sender ? { x: sender.x, y: sender.y } : { x: message.x, y: message.y };
          const dist = distance(meRef.current, at);
          if (dist <= CHAT_RANGE && playingRef.current) {
            const closeness = 1 - dist / CHAT_RANGE;
            const dx = toScreen(at).x - toScreen(meRef.current).x;
            const pan = Math.max(-1, Math.min(1, dx / (CHAT_RANGE * (TILE_WIDTH / 2))));
            audio.playBonk(pan, 0.35 + 0.65 * closeness);
          }
          break;
        }
      }
    },
    [audio, playRemote, receiveChat, triggerBonkEffect],
  );

  const receiveRoom = useCallback(
    (message: RoomServerMessage) => {
      switch (message.t) {
        case "roomHello": {
          myId.current = message.peerId;
          myJoinedAt.current = Date.now();
          setRoomDetail(message.room);
          setPublicSpeakers(message.speakers);
          const center = GARDEN_SIZE / 2;
          const nextMembers: Record<string, RoomMember> = {};
          const nextOthers: Record<string, RemotePlayer> = {};
          for (const member of message.members) {
            nextMembers[member.peerId] = member;
            nextOthers[member.peerId] = {
              id: member.peerId,
              name: member.name,
              place: member.place,
              character: member.character,
              custom: member.custom,
              muted: member.muted,
              carrying: member.carrying,
              x: center,
              y: center,
            };
          }
          setRoomMembers(nextMembers);
          setOthers(nextOthers);
          for (const timer of Object.values(remoteTimers.current)) clearTimeout(timer);
          remoteTimers.current = {};
          setRemoteActions({});
          pendingHold.current = null;
          targets.current = {};

          mesh.current?.closeAll();
          const nextMesh = new MeshPeerManager(
            message.peerId,
            (to, payload) => roomSocket.current?.signal(to, payload),
            handleMeshMessage,
            () => meRef.current,
          );
          mesh.current = nextMesh;
          for (const member of message.members) {
            nextMesh.connectPeer(member.peerId);
          }
          roomSocket.current?.mute(!playingRef.current);
          setLink("online");
          break;
        }
        case "peerJoined": {
          const m = message.member;
          const center = GARDEN_SIZE / 2;
          setRoomMembers((cur) => ({ ...cur, [m.peerId]: m }));
          setOthers((cur) => ({
            ...cur,
            [m.peerId]: {
              id: m.peerId,
              name: m.name,
              place: m.place,
              character: m.character,
              custom: m.custom,
              muted: m.muted,
              carrying: m.carrying,
              x: center,
              y: center,
            },
          }));
          mesh.current?.connectPeer(m.peerId);
          break;
        }
        case "peerLeft": {
          mesh.current?.removePeer(message.peerId);
          delete targets.current[message.peerId];
          clearTimeout(remoteTimers.current[message.peerId]);
          delete remoteTimers.current[message.peerId];
          setRemoteActions((cur) => {
            if (!cur[message.peerId]) return cur;
            const next = { ...cur };
            delete next[message.peerId];
            return next;
          });
          setRoomMembers((cur) => {
            const next = { ...cur };
            delete next[message.peerId];
            return next;
          });
          setOthers((cur) => {
            const next = { ...cur };
            delete next[message.peerId];
            return next;
          });
          break;
        }
        case "signal": {
          void mesh.current?.handleSignal(message.from, { description: message.description, candidate: message.candidate });
          break;
        }
        case "roomUpdated": {
          setRoomDetail(message.room);
          break;
        }
        case "hostChanged": {
          setRoomDetail((cur) =>
            cur ? { ...cur, hostPeerId: message.hostPeerId, hostCountry: message.hostCountry } : cur,
          );
          if (message.hostPeerId === myId.current) {
            showMessage(t("room.hostNow"));
          }
          break;
        }
        case "peerRenamed": {
          if (message.peerId === myId.current) {
            setEntry((cur) => (cur ? { ...cur, name: message.name } : cur));
            setNameError("");
          } else {
            setOthers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], name: message.name } } : cur));
            setRoomMembers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], name: message.name } } : cur));
          }
          break;
        }
        case "peerLook": {
          if (message.peerId === myId.current) {
            if (settingsRef.current.customCharacter && !message.custom) {
              const nextSettings = { ...settingsRef.current, customCharacter: "" };
              settingsRef.current = nextSettings;
              onSettingsRef.current(nextSettings);
            }
          } else {
            const custom = message.custom || undefined;
            setOthers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], character: message.character, custom } } : cur));
            setRoomMembers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], character: message.character, custom } } : cur));
          }
          break;
        }
        case "peerMuted": {
          if (message.peerId !== myId.current) {
            setOthers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], muted: message.muted } } : cur));
            setRoomMembers((cur) => (cur[message.peerId] ? { ...cur, [message.peerId]: { ...cur[message.peerId], muted: message.muted } } : cur));
          }
          break;
        }
        case "speakers":
          setPublicSpeakers(message.speakers);
          break;
        case "hold": {
          if (message.playerId === myId.current) {
            const pending = pendingHold.current;
            pendingHold.current = null;
            const speaker = pending?.id === message.id ? pending : placedRef.current.find((item) => item.id === message.id);
            if (speaker && pending?.id === message.id && !acting.current) {
              setCarryId(speaker.id);
              acting.current = true;
              const kind = actionKindOf(settingsRef.current.character, settingsRef.current.customCharacter);
              const ground = groundSpotFor(meRef.current, speaker, facingRef.current);
              setAction({ name: "lift", startedAt: Date.now(), look: lookOf(speaker.sound), ground, spot: { x: speaker.x, y: speaker.y } });
              setTimeout(() => {
                if (!alive.current) return;
                acting.current = false;
                setAction(undefined);
              }, actionDuration(kind, "lift"));
            }
          } else {
            setOthers((cur) => (cur[message.playerId] ? { ...cur, [message.playerId]: { ...cur[message.playerId], carrying: message.id } } : cur));
            const other = othersRef.current[message.playerId];
            const speaker = placedRef.current.find((item) => item.id === message.id);
            if (other && speaker) {
              const otherFacing = message.facing ?? motionRef.current[message.playerId]?.facing ?? 1;
              playRemote(message.playerId, actionKindOf(other.character, other.custom), "lift", lookOf(speaker.sound), groundSpotFor(other, speaker, otherFacing));
            }
          }
          break;
        }
        case "holdDenied":
          if (pendingHold.current?.id === message.id) {
            pendingHold.current = null;
            flash("notice.speakerHeld");
          } else if (carryIdRef.current === message.id) {
            setCarryId(null);
            setEditing(false);
            flash("notice.speakerHeld");
          }
          break;
        case "release":
          if (message.playerId !== myId.current) {
            setOthers((cur) => (cur[message.playerId] ? { ...cur, [message.playerId]: { ...cur[message.playerId], carrying: undefined } } : cur));
            if (message.x != null && message.y != null) {
              const other = othersRef.current[message.playerId];
              const speaker = placedRef.current.find((item) => item.id === message.id);
              if (other && speaker) {
                const otherFacing = message.facing ?? motionRef.current[message.playerId]?.facing ?? 1;
                playRemote(message.playerId, actionKindOf(other.character, other.custom), "putDown", lookOf(speaker.sound), groundSpotFor(other, { x: message.x, y: message.y }, otherFacing));
              }
            }
          } else if (message.x == null && message.y == null) {
            if (pendingHold.current?.id === message.id) pendingHold.current = null;
            if (carryIdRef.current === message.id) {
              setCarryId(null);
              setEditing(false);
            }
          }
          break;
        case "error":
          if (NAME_ERRORS[message.error]) {
            setNameError(NAME_ERRORS[message.error]);
            break;
          }
          flash(message.error === "LOGIN_REQUIRED" ? "notice.chatLogin" : message.error === "GARDEN_FULL" ? "notice.gardenFull" : "notice.requestFailed");
          break;
      }
    },
    [flash, handleMeshMessage, playRemote, t],
  );

  // --- Legacy public garden connection -----------------------------------------------------------------------
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
          for (const timer of Object.values(remoteTimers.current)) clearTimeout(timer);
          remoteTimers.current = {};
          setRemoteActions({});
          pendingHold.current = null;
          targets.current = {};
          setLink("online");
          break;
        }
        case "join":
          setOthers((current) => ({ ...current, [message.player.id]: message.player }));
          break;
        case "leave":
          delete targets.current[message.id];
          clearTimeout(remoteTimers.current[message.id]);
          delete remoteTimers.current[message.id];
          setRemoteActions((current) => {
            if (!current[message.id]) return current;
            const next = { ...current };
            delete next[message.id];
            return next;
          });
          setOthers((current) => {
            const next = { ...current };
            delete next[message.id];
            return next;
          });
          break;
        case "rename":
          if (message.id === myId.current) {
            setEntry((current) => (current ? { ...current, name: message.name } : current));
            setNameError("");
          } else setOthers((current) => (current[message.id] ? { ...current, [message.id]: { ...current[message.id], name: message.name } } : current));
          break;
        case "moves":
          for (const move of message.moves) if (move.id !== myId.current) targets.current[move.id] = { x: move.x, y: move.y };
          break;
        case "speakers":
          setPublicSpeakers(message.speakers);
          break;
        case "hold": {
          if (message.playerId === myId.current) {
            const pending = pendingHold.current;
            pendingHold.current = null;
            const speaker = pending?.id === message.id ? pending : placedRef.current.find((item) => item.id === message.id);
            if (speaker && pending?.id === message.id && !acting.current) {
              setCarryId(speaker.id);
              acting.current = true;
              const kind = actionKindOf(settingsRef.current.character, settingsRef.current.customCharacter);
              const ground = groundSpotFor(meRef.current, speaker, facingRef.current);
              setAction({ name: "lift", startedAt: Date.now(), look: lookOf(speaker.sound), ground, spot: { x: speaker.x, y: speaker.y } });
              setTimeout(() => {
                if (!alive.current) return;
                acting.current = false;
                setAction(undefined);
              }, actionDuration(kind, "lift"));
            }
          } else {
            setOthers((current) => (current[message.playerId] ? { ...current, [message.playerId]: { ...current[message.playerId], carrying: message.id } } : current));
            const other = othersRef.current[message.playerId];
            const speaker = placedRef.current.find((item) => item.id === message.id);
            if (other && speaker) {
              const otherFacing = message.facing ?? motionRef.current[message.playerId]?.facing ?? 1;
              playRemote(message.playerId, actionKindOf(other.character, other.custom), "lift", lookOf(speaker.sound), groundSpotFor(other, speaker, otherFacing));
            }
          }
          break;
        }
        case "holdDenied":
          if (pendingHold.current?.id === message.id) {
            pendingHold.current = null;
            flash("notice.speakerHeld");
          } else if (carryIdRef.current === message.id) {
            setCarryId(null);
            setEditing(false);
            flash("notice.speakerHeld");
          }
          break;
        case "release":
          if (message.playerId !== myId.current) {
            setOthers((current) => (current[message.playerId] ? { ...current, [message.playerId]: { ...current[message.playerId], carrying: undefined } } : current));
            if (message.x != null && message.y != null) {
              const other = othersRef.current[message.playerId];
              const speaker = placedRef.current.find((item) => item.id === message.id);
              if (other && speaker) {
                const otherFacing = message.facing ?? motionRef.current[message.playerId]?.facing ?? 1;
                playRemote(message.playerId, actionKindOf(other.character, other.custom), "putDown", lookOf(speaker.sound), groundSpotFor(other, { x: message.x, y: message.y }, otherFacing));
              }
            }
          }
          break;
        case "action":
          if (message.playerId !== myId.current) {
            const other = othersRef.current[message.playerId];
            if (other) playRemote(message.playerId, actionKindOf(other.character, other.custom), message.name, message.look);
          }
          break;
        case "look":
          if (message.id === myId.current) {
            if (settingsRef.current.customCharacter && !message.custom) {
              const nextSettings = { ...settingsRef.current, customCharacter: "" };
              settingsRef.current = nextSettings;
              onSettingsRef.current(nextSettings);
            }
          } else setOthers((current) => (current[message.id] ? { ...current, [message.id]: { ...current[message.id], character: message.character, custom: message.custom } } : current));
          break;
        case "chat": {
          receiveChat({
            senderId: message.id,
            name: message.name,
            text: message.text,
            color: message.color,
            x: message.x,
            y: message.y,
          });
          break;
        }
        case "error":
          if (NAME_ERRORS[message.error]) {
            setNameError(NAME_ERRORS[message.error]);
            break;
          }
          flash(message.error === "CHAT_RATE_LIMITED" ? "notice.chatSlow" : message.error === "LOGIN_REQUIRED" ? "notice.chatLogin" : "notice.requestFailed");
          break;
      }
    },
    [flash, playRemote, receiveChat],
  );

  const connect = useCallback(async () => {
    socket.current?.close();
    socket.current = null;
    roomSocket.current?.close();
    roomSocket.current = null;
    mesh.current?.closeAll();
    mesh.current = null;
    setLink("entering");
    setEnterError("");
    try {
      if (isRoom) {
        let ticket = "";
        let entryData: Entry;
        const pre = pendingInitialRoom.current;
        if (pre) {
          pendingInitialRoom.current = null;
          ticket = pre.ticket;
          entryData = pre.entry;
          setRoomDetail(pre.room);
        } else {
          const roomId = roomDetailRef.current?.id;
          if (!roomId) {
            onExit();
            return;
          }
          const coordinates = await requestCoordinates();
          const joined = await client.joinRoom({
            coordinates,
            roomId,
            character: settingsRef.current.character,
            customCharacter: settingsRef.current.customCharacter || undefined,
            deviceId: await getDeviceId(),
          });
          if (!alive.current) return;
          ticket = joined.ticket;
          entryData = joined.entry;
          setRoomDetail(joined.room);
        }
        setEntry(entryData);
        if (entryData.user) {
          const nextSettings = {
            ...settingsRef.current,
            ...(typeof entryData.characterName === "string" ? { name: entryData.characterName } : {}),
            ...(entryData.character ? { character: entryData.character } : {}),
            customCharacter: entryData.customCharacter ?? settingsRef.current.customCharacter,
          };
          settingsRef.current = nextSettings;
          onSettings(nextSettings);
        }
        const nextRoomSocket = new RoomSocket(roomSocketUrl(API_ORIGIN, ticket), receiveRoom, (code) => {
          if (!alive.current) return;
          roomSocket.current = null;
          mesh.current?.closeAll();
          mesh.current = null;
          if (code === ROOM_KICKED_CODE) {
            showMessage(t("room.kickedNotice"));
            void audio.pause().catch(() => undefined);
            onExit();
          } else if (code === ROOM_REPLACED_CODE) {
            setLink("replaced");
            setPanel(null);
            setCarryId(null);
            setEditing(false);
            setPublicSpeakers([]);
            setOthers({});
            void audio.pause().catch(() => undefined);
            setPlaying(false);
            void hidePlayback();
          } else {
            setLink("lost");
          }
        });
        roomSocket.current = nextRoomSocket;
        nextRoomSocket.open();
        return;
      }

      const coordinates = await requestCoordinates();
      const result = await client.enter(coordinates, settingsRef.current.character, settingsRef.current.name, await getDeviceId(), settingsRef.current.customCharacter || undefined);
      if (!alive.current) return;
      setEntry(result);
      if (result.user && typeof result.characterName === "string") {
        const nextSettings = {
          ...settingsRef.current,
          name: result.characterName,
          ...(result.character ? { character: result.character } : {}),
          ...(result.customCharacter !== undefined ? { customCharacter: result.customCharacter ?? "" } : {}),
        };
        settingsRef.current = nextSettings;
        onSettings(nextSettings);
      }
      const next = new GardenSocket(socketUrl(API_ORIGIN, result.ticket), receive, (code) => {
        if (!alive.current) return;
        socket.current = null;
        if (code === REPLACED_CODE) {
          setLink("replaced");
          setPanel(null);
          setCarryId(null);
          setEditing(false);
          setPublicSpeakers([]);
          setOthers({});
          void audio.pause().catch(() => undefined);
          setPlaying(false);
          void hidePlayback();
        } else {
          setLink("lost");
        }
      });
      socket.current = next;
      next.open();
    } catch (cause) {
      if (!alive.current) return;
      if (isRoom && cause instanceof ApiError && (cause.code === "ROOM_NOT_FOUND" || cause.code === "BANNED")) {
        showMessage(t(ENTER_ERRORS[cause.code]));
        onExit();
        return;
      }
      setEnterError((cause instanceof ApiError && ENTER_ERRORS[cause.code]) || "notice.connectFailed");
      setLink(settingsRef.current.consent ? "lost" : "consent");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isRoom, receive, receiveRoom]);

  useEffect(() => {
    if (online && (isRoom || settings.consent)) void connect();
    return () => {
      socket.current?.close();
      roomSocket.current?.close();
      mesh.current?.closeAll();
    };
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

  // --- speakers ----------------------------------------------------------------------------------------------
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pushPublic = useCallback(
    (speaker: Speaker) => {
      clearTimeout(saveTimers.current[speaker.id]);
      saveTimers.current[speaker.id] = setTimeout(() => {
        if (isRoom) {
          roomSocket.current?.saveSpeaker(speaker);
        } else {
          client.saveSpeaker(speaker).catch((cause) =>
            flash(cause instanceof ApiError && cause.status === 403 ? "notice.noPermission" : "notice.saveFailed"),
          );
        }
      }, isRoom ? 150 : SAVE_DELAY_MS);
    },
    [client, flash, isRoom],
  );

  const changeSpeakers = useCallback(
    (next: Speaker[], changedId?: string) => {
      if (!online) return onGarden({ ...gardenRef.current, speakers: next });
      setPublicSpeakers(next);
      const changed = next.find((speaker) => speaker.id === changedId);
      if (changed) pushPublic(changed);
    },
    [online, onGarden, pushPublic],
  );

  const carried = carryId ? placed.find((speaker) => speaker.id === carryId) : undefined;

  useEffect(() => {
    if (carryId && !carried && !acting.current) {
      setCarryId(null);
      setEditing(false);
    }
  }, [carryId, carried]);

  const play = useCallback((name: ActionName, look: SourceLook, after: () => void, ground?: GroundSpot, spot?: Point) => {
    acting.current = true;
    setAction({ name, startedAt: Date.now(), look, ground, spot });
    setTimeout(() => {
      if (!alive.current) return;
      acting.current = false;
      setAction(undefined);
      after();
    }, actionDuration(actionKindOf(settingsRef.current.character, settingsRef.current.customCharacter), name));
  }, []);

  const lift = (speaker: Speaker) => {
    if (acting.current || carryId || pendingHold.current) return;
    if (online) {
      pendingHold.current = speaker;
      if (isRoom) roomSocket.current?.hold(speaker.id, facing);
      else socket.current?.hold(speaker.id, facing);
      return;
    }
    setCarryId(speaker.id);
    play("lift", lookOf(speaker.sound), () => undefined, groundSpotFor(meRef.current, speaker, facing), { x: speaker.x, y: speaker.y });
  };

  const putDown = () => {
    if (!carryId || !carried || acting.current) return;
    const id = carryId;
    setEditing(false);
    const ahead = toGarden({ x: facing * 40, y: 14 });
    const spot = clampToGarden({ x: meRef.current.x + ahead.x, y: meRef.current.y + ahead.y });
    if (isRoom) roomSocket.current?.release(id, spot, facing);
    else if (online) socket.current?.release(id, spot, facing);
    play("putDown", lookOf(carried.sound), () => {
      setCarryId(null);
      if (placedRef.current.some((speaker) => speaker.id === id)) changeSpeakers(moveSpeaker(placedRef.current, id, spot), id);
    }, groundSpotFor(meRef.current, spot, facing), spot);
  };

  const create = () => {
    if (acting.current || carryId || pendingHold.current) return;
    if (placed.length >= MAX_SPEAKERS) return flash("notice.maxSpeakers", { n: MAX_SPEAKERS });
    if (isRoom) mesh.current?.broadcast({ t: "action", name: "create", look: lookOf(defaultSound()), facing });
    else if (online) socket.current?.action("create", lookOf(defaultSound()), facing);
    play("create", lookOf(defaultSound()), () => {
      if (placedRef.current.length >= MAX_SPEAKERS) return;
      const id = newId();
      changeSpeakers(addSpeaker(placedRef.current, meRef.current, id), id);
      setCarryId(id);
      if (isRoom) roomSocket.current?.hold(id, facing);
      else if (online) socket.current?.hold(id, facing);
    });
  };

  const discard = () => {
    if (acting.current || !carried) return;
    const id = carried.id;
    setEditing(false);
    if (isRoom) mesh.current?.broadcast({ t: "action", name: "discard", look: lookOf(carried.sound), facing });
    else if (online) socket.current?.action("discard", lookOf(carried.sound), facing);
    play("discard", lookOf(carried.sound), () => {
      setCarryId(null);
      if (!online) return onGarden({ ...gardenRef.current, speakers: removeSpeaker(placedRef.current, id) });
      setPublicSpeakers(removeSpeaker(placedRef.current, id));
      clearTimeout(saveTimers.current[id]);
      if (isRoom) {
        roomSocket.current?.deleteSpeaker(id);
      } else {
        client.deleteSpeaker(id).catch(() => flash("notice.deleteFailed"));
      }
    });
  };

  // --- toy hammer bonk ---------------------------------------------------------------------------------------
  const bonkPlayer = (target: RemotePlayer) => {
    if (!isRoom || !roomDetailRef.current?.allowInteraction) return;
    const now = Date.now();
    if (now - lastBonkAt.current < BONK_COOLDOWN_MS) return;
    lastBonkAt.current = now;

    const dxScreen = toScreen(target).x - toScreen(meRef.current).x;
    if (dxScreen > 2) setFacing(1);
    else if (dxScreen < -2) setFacing(-1);

    triggerBonkEffect("me", "swing");
    triggerBonkEffect(target.id, "hit");
    if (playingRef.current) {
      const pan = Math.max(-1, Math.min(1, dxScreen / (CHAT_RANGE * (TILE_WIDTH / 2))));
      audio.playBonk(pan, 1);
    }
    mesh.current?.broadcast({
      t: "bonk",
      targetId: target.id,
      x: meRef.current.x,
      y: meRef.current.y,
    });
  };

  // --- chat and account --------------------------------------------------------------------------------------
  const sendChat = () => {
    const text = cleanMessage(draft);
    if (text) {
      if (isRoom) {
        if (!entry?.canChat) {
          flash("notice.chatLogin");
          return;
        }
        const now = Date.now();
        if (now - lastChatSentAt.current < CHAT_COOLDOWN_MS) {
          flash("notice.chatSlow");
          return;
        }
        lastChatSentAt.current = now;
        const color = settingsRef.current.chatColor || undefined;
        mesh.current?.broadcast({ t: "chat", text, ...(color ? { color } : {}), x: meRef.current.x, y: meRef.current.y });
        receiveChat({
          senderId: myId.current,
          name: entry?.name || settingsRef.current.name || t("name.me"),
          text,
          color,
          x: meRef.current.x,
          y: meRef.current.y,
        });
      } else {
        socket.current?.chat(text, settingsRef.current.chatColor || undefined);
      }
      setDraft("");
    }
    chatInput.current?.blur();
  };

  const changeName = (name: string) => {
    if (online && !entry?.user) return;
    setNameError("");
    onSettings({ ...settings, name });
    settingsRef.current = { ...settings, name };
    if (isRoom) roomSocket.current?.rename(name);
    else if (online) socket.current?.rename(name);
  };

  const afterLogin = async (_user: User) => {
    setPanel(null);
    await onSyncAccount?.();
    await connect();
  };

  const logout = async () => {
    try {
      await client.logout();
      setPanel(null);
      await connect();
    } catch {
      flash("notice.logoutFailed");
    }
  };

  const myName = online ? entry?.name ?? "…" : settings.name || t("name.me");
  const actors: Actor[] = useMemo(() => {
    const list: Actor[] = Object.values(others).map((player) => {
      const remoteAction = remoteActions[player.id];
      const held = player.carrying ? placed.find((speaker) => speaker.id === player.carrying) : undefined;
      return {
        id: player.id,
        x: player.x,
        y: player.y,
        name: player.name,
        label: player.place,
        bubble: bubbles[player.id]?.text,
        kind: player.character,
        custom: player.custom,
        facing: motion[player.id]?.facing,
        walking: motion[player.id]?.walking,
        muted: player.muted,
        bonk: bonks[player.id],
        carrying: remoteAction ? undefined : held ? lookOf(held.sound) : undefined,
        action: remoteAction,
      };
    });
    list.push({
      id: "me",
      x: me.x,
      y: me.y,
      name: myName,
      label: place || "…",
      bubble: bubbles.me?.text,
      kind: settings.character,
      custom: settings.customCharacter || undefined,
      facing,
      walking,
      muted: !playing,
      stamina: staminaUi,
      bonk: bonks.me,
      carrying: action ? undefined : carried ? lookOf(carried.sound) : undefined,
      action,
    });
    return list;
  }, [others, remoteActions, placed, motion, bubbles, bonks, me, myName, place, facing, walking, playing, staminaUi, settings.character, settings.customCharacter, carried, action]);

  const liftable = useMemo(() => {
    if (!canEdit || carryId || action) return null;
    return placed
      .filter((speaker) => !heldIds.has(speaker.id))
      .map((speaker) => ({ speaker, gap: distance(speaker, me) }))
      .filter((item) => item.gap <= PICK_UP_TILES)
      .sort((a, b) => a.gap - b.gap)[0]?.speaker ?? null;
  }, [canEdit, carryId, action, placed, heldIds, me]);

  const bonkable = useMemo(() => {
    if (!isRoom || !roomDetail?.allowInteraction || carryId || action || liftable) return null;
    return Object.values(others)
      .map((player) => ({ player, gap: distance(player, me) }))
      .filter((item) => item.gap <= BONK_RANGE)
      .sort((a, b) => a.gap - b.gap)[0]?.player ?? null;
  }, [isRoom, roomDetail?.allowInteraction, carryId, action, liftable, others, me]);

  const markers: Marker[] = [];
  if (liftable) {
    markers.push({
      id: "lift",
      x: liftable.x,
      y: liftable.y,
      offsetX: 66,
      offsetY: -34,
      content: <Btn small variant="mint" title={t("near.lift")} onPress={() => lift(liftable)} testID="speaker-lift" />,
    });
  }
  if (bonkable) {
    markers.push({
      id: "bonk",
      x: bonkable.x,
      y: bonkable.y,
      offsetX: -54,
      offsetY: -34,
      content: <Btn small variant="primary" title={t("near.bonk")} onPress={() => bonkPlayer(bonkable)} testID="player-bonk" />,
    });
  }
  if (carried && !action) {
    markers.push({
      id: "hold",
      x: me.x,
      y: me.y,
      offsetX: wide ? 104 : 0,
      offsetY: wide ? -30 : 30,
      content: (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Btn small variant="mint" title={t("hold.putDown")} onPress={putDown} testID="speaker-put-down" />
          {!editing && <Btn small title={t("hold.edit")} onPress={() => setEditing(true)} testID="speaker-edit" />}
        </View>
      ),
    });
  }

  const heard = audibleCount(me, speakers);
  const showEditor = editing && !!carried && !action;

  const settingsHandlers = useRef({ onSettings, changeName, togglePlay, logout, onExit, downloadNature, developer });
  settingsHandlers.current = { onSettings, changeName, togglePlay, logout, onExit, downloadNature, developer };
  const settingsOpen = panel === "settings";
  const loggedIn = !!(entry?.user ?? client.currentUser);
  const settingsCard = useMemo(
    () => (
      <SettingsCard
        client={client}
        open={settingsOpen}
        playing={playing}
        settings={settings}
        user={entry?.user ?? null}
        online={online}
        shownName={myName}
        nameError={nameError ? t(nameError) : ""}
        nature={patch?.phase ?? null}
        onDownloadNature={() => settingsHandlers.current.downloadNature()}
        developer={
          mode === "test" ? (
            <View testID="developer-options" style={{ gap: 6, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: colors.butter, borderStyle: "dashed" }}>
              <T size={12.5} tone="muted" weight="700">{t("dev.title")}</T>
              <Btn small title={t("dev.redownload")} onPress={() => settingsHandlers.current.developer.redownload()} testID="dev-redownload" />
              <Btn small title={t("dev.notice")} onPress={() => settingsHandlers.current.developer.notice()} testID="dev-notice" />
              <Btn small title={t("dev.notices")} onPress={() => settingsHandlers.current.developer.notices()} testID="dev-notices" />
              <Btn small title={t("dev.flash")} onPress={() => settingsHandlers.current.developer.flash()} testID="dev-flash" />
            </View>
          ) : undefined
        }
        custom={<MyCharacters client={client} loggedIn={loggedIn} open={settingsOpen} settings={settings} onChange={(next) => settingsHandlers.current.onSettings(next)} />}
        onChange={(next) => settingsHandlers.current.onSettings(next)}
        onName={(name) => settingsHandlers.current.changeName(name)}
        onPresets={() => setPanel("presets")}
        onLogin={() => setPanel("login")}
        onLogout={() => void settingsHandlers.current.logout()}
        onExit={() => settingsHandlers.current.onExit()}
        onClose={() => setPanel(null)}
      />
    ),
    [settingsOpen, playing, settings, entry?.user, online, myName, nameError, t, patch?.phase, client, loggedIn, mode],
  );
  const lostText = online && link === "lost" ? t(enterError || "notice.lost") : "";
  useEffect(() => {
    if (lostText) showToast({ id: "connection", text: lostText, kind: "message", seconds: null });
    else dismissToast("connection");
  }, [lostText]);
  useEffect(() => () => dismissToast("connection"), []);

  const roomRoster = useMemo((): RoomMember[] => {
    if (!isRoom || !roomDetail) return [];
    const list: RoomMember[] = Object.values(roomMembers);
    list.push({
      peerId: myId.current,
      name: myName,
      place: place || "…",
      country: entry?.country ?? roomDetail.hostCountry,
      character: settings.character,
      custom: settings.customCharacter || undefined,
      muted: !playing,
      joinedAt: myJoinedAt.current,
      isGuest: !entry?.user,
    });
    return list;
  }, [isRoom, roomDetail, roomMembers, myName, place, entry?.country, entry?.user, settings.character, settings.customCharacter, playing]);

  if (online && link === "replaced") {
    return (
      <View testID="garden-replaced" style={{ flex: 1, backgroundColor: colors.sky, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 380, backgroundColor: colors.panel, borderRadius: 24, borderWidth: 2, borderColor: colors.panelEdge, padding: 20, gap: 14 }}>
          <T size={15} weight="700">{t("notice.replaced")}</T>
          <Btn variant="primary" title={t("common.back")} onPress={onExit} testID="replaced-exit" />
        </View>
      </View>
    );
  }

  const statusTitle = isRoom && roomDetail
    ? `${countryFlag(roomDetail.hostCountry.code)} ${roomDetail.name} · ${t("lobby.players", { count: Object.keys(others).length + 1, max: roomDetail.maxPlayers })}`
    : t(online ? "status.public" : mode === "test" ? "status.test" : "status.mine") +
      (online && link === "online" ? " · " + t("status.people", { n: Object.keys(others).length + 1 }) : "");

  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, flexDirection: "column" }}>
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
      <View style={{ flex: 1 }}>
        <Scene me={me} actors={actors} speakers={speakers} carriedId={carryId} heldIds={heldIds} chatRipples={chatRipples} markers={markers} onInput={(input) => (joystick.current = input)} />

        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 10, gap: 6 }}>
          <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 6 }}>
              {canEdit && link === "online" && (
                carried
                  ? <Btn small variant="danger" title={t("top.discard")} disabled={!!action} onPress={discard} testID="speaker-discard" />
                  : <Btn small variant="primary" title={t("top.create")} disabled={!!action || !!carryId} onPress={create} testID="speaker-create" />
              )}
              {isRoom && link === "online" && roomDetail && (
                <Btn small title={t("room.button")} onPress={() => setPanel("room")} testID="open-room-panel" />
              )}
            </View>
            {wide && (
              <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
                <GardenStatus
                  title={statusTitle}
                  detail={patch?.phase === "failed" ? t("patch.failed") : t("status.heard", { n: heard })}
                  progress={patch?.phase === "downloading" ? (patch.totalBytes ? patch.doneBytes / patch.totalBytes : 0) : null}
                  gaugeLabel={t("status.downloading")}
                />
              </View>
            )}
            <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
              <SoundButton
                compact={!wide}
                playing={playing}
                volume={settings.volume}
                mono={settings.mono}
                onToggle={() => void togglePlay()}
                onVolume={(volume) => onSettings({ ...settings, volume })}
                onMono={(mono) => onSettings({ ...settings, mono })}
              />
              <IconBtn label={t("top.settings")} onPress={() => setPanel("settings")} testID="open-settings">
                <GearIcon />
              </IconBtn>
            </View>
          </View>
        </View>

        {!showEditor && (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              right: 12,
              bottom: insets.bottom + (!wide && online && link === "online" ? 70 : 14),
              zIndex: 5,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("sprint.button")}
              testID="sprint-button"
              onPressIn={() => {
                touchSprint.current = true;
                setSprintDown(true);
              }}
              onPressOut={() => {
                touchSprint.current = false;
                setSprintDown(false);
              }}
              style={{
                minHeight: 38,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor: sprintDown ? colors.mint : "rgba(255, 250, 242, 0.92)",
                borderWidth: 2,
                borderBottomWidth: sprintDown ? 2 : 4,
                borderColor: sprintDown ? colors.mintDeep : colors.panelEdge,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={12.5} weight="800">{t("sprint.button")}</T>
            </Pressable>
          </View>
        )}

        {online && link === "online" && !showEditor && (
          <View pointerEvents="box-none" style={{ position: "absolute", left: 10, right: wide ? 100 : 10, bottom: insets.bottom + 10, maxWidth: 520, gap: 6 }}>
            <ChatLog entries={chatLog} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              {entry?.canChat ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Input inputRef={chatInput} label={t("chat.label")} placeholder={t("chat.placeholder")} value={draft} maxLength={CHAT_MAX_LENGTH} onChangeText={setDraft} onSubmit={sendChat} testID="chat-input" />
                  </View>
                  <Btn variant="primary" title={t("chat.send")} disabled={!draft.trim()} onPress={sendChat} testID="chat-send" />
                </>
              ) : (
                <Btn small variant="mint" title={t("chat.login")} onPress={() => setPanel("login")} testID="chat-login" />
              )}
            </View>
          </View>
        )}
      </View>

      {showEditor && carried && (
        <View style={wide ? { width: 380, backgroundColor: colors.panel, borderLeftWidth: 2, borderLeftColor: colors.panelEdge, paddingTop: insets.top } : { height: "56%", backgroundColor: colors.panel, borderTopWidth: 2, borderTopColor: colors.panelEdge, paddingBottom: insets.bottom }}>
          <SpeakerEditor
            speaker={carried}
            onChange={(speaker) => changeSpeakers(updateSpeaker(placedRef.current, speaker.id, { name: speaker.name, sound: speaker.sound }), speaker.id)}
            onClose={() => setEditing(false)}
            readSpectrum={() => audio.spectrum(carried.id)}
            natureLock={natureLock}
            presets={settings.speakerPresets}
            onSavePreset={onSaveSpeakerPreset}
            onDeletePreset={onDeleteSpeakerPreset}
          />
        </View>
      )}
    </View>
    <AdBanner visible={!panel && !askNature && !(online && (link === "consent" || link === "entering" || link === "replaced"))} />

      {online && (link === "consent" || link === "entering") && (
        <Modal>
          {link === "consent" ? (
            <ConsentCard
              busy={false}
              error={enterError ? t(enterError) : ""}
              onCancel={onExit}
              onAgree={() => {
                onSettings({ ...settings, consent: true });
                settingsRef.current = { ...settings, consent: true };
                void connect();
              }}
            />
          ) : (
            <View style={{ backgroundColor: colors.panel, borderRadius: 24, borderWidth: 2, borderColor: colors.panelEdge, padding: 18, gap: 12 }}>
              <T size={16} weight="800">{t("entering.title")}</T>
              <Btn title={t("common.back")} onPress={onExit} />
            </View>
          )}
        </Modal>
      )}
      {askNature && !(online && (link === "consent" || link === "entering")) && (
        <Modal>
          <NatureDownloadCard megabytes={Math.max(1, Math.round(askNature.bytes / 1e6))} onDownload={() => answerNature(true)} onLater={(dontAsk) => answerNature(false, dontAsk)} />
        </Modal>
      )}
      <Modal hidden={panel !== "settings"} onClose={() => setPanel(null)}>
        {settingsCard}
      </Modal>
      {panel === "login" && (
        <Modal onClose={() => setPanel(null)}>
          <LoginCard client={client} onLoggedIn={afterLogin} onClose={() => setPanel(null)} />
        </Modal>
      )}
      {panel === "room" && isRoom && roomDetail && (
        <Modal onClose={() => setPanel(null)}>
          <RoomPanel
            room={roomDetail}
            myPeerId={myId.current}
            members={roomRoster}
            onUpdateSettings={(patch) => roomSocket.current?.updateSettings(patch)}
            onTransferHost={(peerId) => roomSocket.current?.transferHost(peerId)}
            onKick={(peerId) => roomSocket.current?.kick(peerId)}
            onLeave={() => {
              setPanel(null);
              onExit();
            }}
            onClose={() => setPanel(null)}
          />
        </Modal>
      )}
      {panel === "presets" && (
        <Modal onClose={() => setPanel(null)}>
          <PresetCard
            garden={garden}
            onApply={(id) => {
              setCarryId(null);
              setEditing(false);
              onGarden(applyPreset(garden, id));
            }}
            onSave={(name) => onGarden(savePreset(garden, name, newId()))}
            onDelete={(id) => onGarden(deletePreset(garden, id))}
            onReset={() => {
              setCarryId(null);
              setEditing(false);
              onGarden(resetGarden());
            }}
            onClose={() => setPanel(null)}
          />
        </Modal>
      )}
    </View>
  );
}
