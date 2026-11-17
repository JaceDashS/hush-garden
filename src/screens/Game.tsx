/**
 * The playable garden. `mode` "mine" is the private offline garden kept on the device; "public" is the shared
 * garden on the server, which needs location consent to enter and a login to chat.
 *
 * Speakers are handled with the character's hands: a speaker is made into the hands, lifted from the ground when
 * the character stands near it, edited only while held, and put down or discarded from the hands.
 */
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View, useWindowDimensions, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HushClient } from "../api/client";
import { GardenSocket, REPLACED_CODE, socketUrl } from "../api/socket";
import { getDeviceId } from "../deviceId";
import { ApiError, type Entry, type RemotePlayer, type ServerMessage, type User } from "../api/types";
import type { GardenAudio } from "../audio/engine";
import { hidePlayback, onPlaybackButtons, showPlayback } from "../audio/session";
import { MyCharacters } from "../components/MyCharacters";
import { ChatLog } from "../components/ChatLog";
import { ConsentCard, LoginCard, NatureDownloadCard, PresetCard, SettingsCard } from "../components/Panels";
import { dismissToast, showMessage, showToast } from "../toasts";
import { loadNotices, showNotices } from "../api/notices";
import { GardenStatus } from "../components/GardenStatus";
import { SOUND_KEY_CODE, SoundButton } from "../components/SoundButton";
import { SpeakerEditor } from "../components/SpeakerEditor";
import { clearPatch, startPatch, usePatchState } from "../audio/patchSession";
import { API_ORIGIN } from "../config";
import { actionDuration, actionKindOf, liftTravel, type ActionName, type GroundSpot } from "../domain/actions";
import { PICK_UP_TILES } from "../domain/characters";
import { BUBBLE_MS, CHAT_MAX_LENGTH, appendChatEntry, cleanMessage, cueFor, type ChatEntry } from "../domain/chat";
import { addSpeaker, applyPreset, deletePreset, moveSpeaker, removeSpeaker, resetGarden, savePreset, updateSpeaker, type MyGarden } from "../domain/garden";
import { MAX_SPEAKERS, audibleCount, defaultSound, lookOf, type SourceLook, type Speaker } from "../domain/sound";
import type { TextKey } from "../domain/text";
import { GARDEN_SIZE, clampToGarden, distance, keysToInput, step, toGarden, type Point } from "../domain/world";
import { Scene, groundSpotFor, type Actor, type Marker } from "../game/Scene";
import { useT } from "../i18n";
import { requestCoordinates } from "../location";
import type { Settings } from "../settings";
import { Btn, GearIcon, IconBtn, Input, Modal, T, colors } from "../ui";

type Panel = null | "settings" | "presets" | "login";
/** `replaced`: a newer visit from this device took over; this one does not reconnect by itself. */
type Link = "consent" | "entering" | "online" | "lost" | "replaced";

const SAVE_DELAY_MS = 400;
const RETRY_MS = 3000;

const newId = () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ENTER_ERRORS: Record<string, TextKey> = {
  RATE_LIMITED: "notice.rateLimited",
  GARDEN_FULL: "notice.gardenFull",
};
const NAME_ERRORS: Record<string, TextKey> = {
  NAME_NOT_ALLOWED: "name.notAllowed",
  NAME_SAVE_FAILED: "name.saveFailed",
  NAME_RATE_LIMITED: "name.rateLimited",
};

export function Game({ mode, client, audio, settings, onSettings, garden, onGarden, onExit }: { mode: "mine" | "public" | "test"; client: HushClient; audio: GardenAudio; settings: Settings; onSettings: (settings: Settings) => void; garden: MyGarden; onGarden: (garden: MyGarden) => void; onExit: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const online = mode === "public";

  const [me, setMe] = useState<Point>({ x: GARDEN_SIZE / 2, y: GARDEN_SIZE / 2 + 1 });
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [playing, setPlaying] = useState(audio.running);
  const [panel, setPanel] = useState<Panel>(null);
  /** The speaker in the character's hands. */
  const [carryId, setCarryId] = useState<string | null>(null);
  /** The action being played. The character cannot walk or start another one until it ends. */
  const [action, setAction] = useState<(Actor["action"] & { spot?: Point }) | undefined>(undefined);
  /** Redrawn while a speaker is lifted or put down, so its sound and waves move with it. */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!action?.spot) return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 33);
    return () => clearInterval(timer);
  }, [action]);
  /** The editor of the held speaker is open. */
  const [editing, setEditing] = useState(false);
  const [nameError, setNameError] = useState<TextKey | "">("");

  const [link, setLink] = useState<Link>(online ? (settings.consent ? "entering" : "consent") : "online");
  const [enterError, setEnterError] = useState<TextKey | "">("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [publicSpeakers, setPublicSpeakers] = useState<Speaker[]>([]);
  const [others, setOthers] = useState<Record<string, RemotePlayer>>({});
  /** Which way each other player faces and whether it is walking, derived from its reported movement. */
  const [motion, setMotion] = useState<Record<string, { facing: 1 | -1; walking: boolean }>>({});
  const [bubbles, setBubbles] = useState<Record<string, { text: string; until: number }>>({});
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const nextChatId = useRef(0);
  const [draft, setDraft] = useState("");
  const chatInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const desktopChat = Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const placed = online ? publicSpeakers : garden.speakers;
  /**
   * A carried speaker is wherever the character is, so its sound and its shadow travel along. While it is lifted
   * or put down, it is where the animation has carried it along the ground between its spot and the character.
   */
  const carriedAt = useMemo((): Point => {
    if (!action?.spot || (action.name !== "lift" && action.name !== "putDown")) return me;
    const travel = liftTravel(actionKindOf(settings.character, settings.customCharacter), action.name, clock - action.startedAt);
    return { x: action.spot.x + (me.x - action.spot.x) * travel, y: action.spot.y + (me.y - action.spot.y) * travel };
  }, [action, clock, me, settings.character, settings.customCharacter]);
  const speakers = useMemo(() => (carryId ? placed.map((speaker) => (speaker.id === carryId ? { ...speaker, x: carriedAt.x, y: carriedAt.y } : speaker)) : placed), [placed, carryId, carriedAt]);
  const placedRef = useRef(placed);
  placedRef.current = placed;
  const gardenRef = useRef(garden);
  gardenRef.current = garden;
  const acting = useRef(false);
  const canEdit = online ? !!entry?.canEdit : true;
  const myId = useRef("me");
  const meRef = useRef(me);
  meRef.current = me;
  const joystick = useRef<Point>({ x: 0, y: 0 });
  const keys = useRef(new Set<string>());
  const socket = useRef<GardenSocket | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSettingsRef = useRef(onSettings);
  onSettingsRef.current = onSettings;
  const targets = useRef<Record<string, Point>>({});
  const alive = useRef(true);

  /** A short message for the player, as a toast from the top. */
  const flash = useCallback((key: TextKey, values?: Record<string, string | number>) => showMessage(t(key, values)), [t]);

  // --- sound -------------------------------------------------------------------------------------------------
  useEffect(() => audio.setSpeakers(speakers), [audio, speakers]);
  // Entering a garden checks the nature sounds. When files are missing the player is asked first (unless they
  // agreed before or ticked "don't ask again"); nature sources stay silent and unchoosable until all are there.
  const [askNature, setAskNature] = useState<{ bytes: number; answer: (yes: boolean) => void } | null>(null);
  const askDownload = useCallback((bytes: number) => {
    const choice = settingsRef.current.natureSounds;
    if (choice !== "ask") return Promise.resolve(choice === "yes");
    return new Promise<boolean>((answer) => setAskNature({ bytes, answer }));
  }, []);
  useEffect(() => startPatch(audio, askDownload), [audio, askDownload]);
  // Platform notices are fetched on entering a garden and shown as toasts, each once per app run.
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
  /** Developer options of the test garden. */
  const developer = {
    // Forget the stored files and the earlier answer, so the question and the whole download happen again.
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
  // The key handler is set up once, so it reaches the current toggle through a ref.
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

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
      // Escape opens the settings, and closes them (or any other open panel) again.
      if (event.key === "Escape" && !event.repeat) {
        event.preventDefault();
        setPanel((open) => (open ? null : typing(event) ? open : "settings"));
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
      // The character stays in place while it makes, lifts or discards a speaker.
      const input = acting.current ? { x: 0, y: 0 } : stick.x || stick.y ? stick : keysToInput(keys.current);
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
            // Right on screen is +x and -y in the garden.
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
        case "look":
          if (message.id === myId.current) {
            // The character image in use was deleted: back to the drawn character.
            if (settingsRef.current.customCharacter && !message.custom) {
              const nextSettings = { ...settingsRef.current, customCharacter: "" };
              settingsRef.current = nextSettings;
              onSettingsRef.current(nextSettings);
            }
          } else setOthers((current) => (current[message.id] ? { ...current, [message.id]: { ...current[message.id], character: message.character, custom: message.custom } } : current));
          break;
        case "chat": {
          const mine = message.id === myId.current;
          const at = Date.now();
          nextChatId.current += 1;
          setBubbles((current) => ({ ...current, [mine ? "me" : message.id]: { text: (mine ? "" : message.name + ": ") + message.text, until: at + BUBBLE_MS } }));
          setChatLog((current) => appendChatEntry(current, { id: `${at}-${nextChatId.current}`, senderId: message.id, name: message.name, text: message.text, at, mine }));
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
          if (NAME_ERRORS[message.error]) {
            setNameError(NAME_ERRORS[message.error]);
            break;
          }
          flash(message.error === "CHAT_RATE_LIMITED" ? "notice.chatSlow" : message.error === "LOGIN_REQUIRED" ? "notice.chatLogin" : "notice.requestFailed");
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
      const result = await client.enter(coordinates, settingsRef.current.character, settingsRef.current.name, await getDeviceId(), settingsRef.current.customCharacter || undefined);
      if (!alive.current) return;
      setEntry(result);
      if (result.user && typeof result.characterName === "string") {
        const nextSettings = { ...settingsRef.current, name: result.characterName };
        settingsRef.current = nextSettings;
        onSettings(nextSettings);
      }
      const next = new GardenSocket(socketUrl(API_ORIGIN, result.ticket), receive, (code) => {
        if (!alive.current) return;
        socket.current = null;
        setLink(code === REPLACED_CODE ? "replaced" : "lost");
      });
      socket.current = next;
      next.open();
    } catch (cause) {
      if (!alive.current) return;
      setEnterError((cause instanceof ApiError && ENTER_ERRORS[cause.code]) || "notice.connectFailed");
      setLink(settingsRef.current.consent ? "lost" : "consent");
    }
    // Settings are read through a ref, so saving them does not restart the connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // --- speakers ----------------------------------------------------------------------------------------------
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pushPublic = useCallback(
    (speaker: Speaker) => {
      clearTimeout(saveTimers.current[speaker.id]);
      saveTimers.current[speaker.id] = setTimeout(() => {
        client.saveSpeaker(speaker).catch((cause) => flash(cause instanceof ApiError && cause.status === 403 ? "notice.noPermission" : "notice.saveFailed"));
      }, SAVE_DELAY_MS);
    },
    [client, flash],
  );

  /** Stores a new speaker list. Edits must start from `placedRef.current`, never from the list with the carried speaker moved. */
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

  // A held speaker that someone else removed leaves the hands empty.
  useEffect(() => {
    if (carryId && !carried && !acting.current) {
      setCarryId(null);
      setEditing(false);
    }
  }, [carryId, carried]);

  /** Plays an action of the player's character and runs `after` when it ends. */
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

  /** Lifts a speaker the character stands next to. */
  const lift = (speaker: Speaker) => {
    if (acting.current || carryId) return;
    setCarryId(speaker.id);
    // The speaker leaves the ground from where it stands, so the lift starts exactly on the drawn speaker.
    play("lift", lookOf(speaker.sound), () => undefined, groundSpotFor(meRef.current, speaker, facing), { x: speaker.x, y: speaker.y });
  };

  /** Puts the carried speaker down one step in front of the character. */
  const putDown = () => {
    if (!carryId || !carried || acting.current) return;
    const id = carryId;
    setEditing(false);
    // The lift played backwards; the speaker lands when it ends.
    // The spot is fixed when the button is pressed, so the animation ends exactly where the speaker then stands.
    const ahead = toGarden({ x: facing * 40, y: 14 });
    const spot = clampToGarden({ x: meRef.current.x + ahead.x, y: meRef.current.y + ahead.y });
    play("putDown", lookOf(carried.sound), () => {
      setCarryId(null);
      if (placedRef.current.some((speaker) => speaker.id === id)) changeSpeakers(moveSpeaker(placedRef.current, id, spot), id);
    }, groundSpotFor(meRef.current, spot, facing), spot);
  };

  /** Makes a new speaker; when the character's animation ends, the speaker is in its hands. */
  const create = () => {
    if (acting.current || carryId) return;
    if (placed.length >= MAX_SPEAKERS) return flash("notice.maxSpeakers", { n: MAX_SPEAKERS });
    play("create", lookOf(defaultSound()), () => {
      if (placedRef.current.length >= MAX_SPEAKERS) return;
      const id = newId();
      changeSpeakers(addSpeaker(placedRef.current, meRef.current, id), id);
      setCarryId(id);
    });
  };

  /** Discards the held speaker; it is removed when the character's animation ends. */
  const discard = () => {
    if (acting.current || !carried) return;
    const id = carried.id;
    setEditing(false);
    play("discard", lookOf(carried.sound), () => {
      setCarryId(null);
      if (!online) return onGarden({ ...gardenRef.current, speakers: removeSpeaker(placedRef.current, id) });
      setPublicSpeakers(removeSpeaker(placedRef.current, id));
      clearTimeout(saveTimers.current[id]);
      client.deleteSpeaker(id).catch(() => flash("notice.deleteFailed"));
    });
  };

  // --- chat and account --------------------------------------------------------------------------------------
  const sendChat = () => {
    const text = cleanMessage(draft);
    if (!text) return;
    socket.current?.chat(text);
    setDraft("");
    if (desktopChat) chatInput.current?.focus();
  };

  /** Saves the character name. Online, the server decides and answers with a rename or an error. */
  const changeName = (name: string) => {
    setNameError("");
    onSettings({ ...settings, name });
    settingsRef.current = { ...settings, name };
    if (online) socket.current?.rename(name);
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
      flash("notice.logoutFailed");
    }
  };

  const myName = online ? entry?.name ?? "…" : settings.name || t("name.me");
  const actors: Actor[] = useMemo(() => {
    const list: Actor[] = Object.values(others).map((player) => ({ id: player.id, x: player.x, y: player.y, name: player.name, label: player.place, bubble: bubbles[player.id]?.text, kind: player.character, custom: player.custom, facing: motion[player.id]?.facing, walking: motion[player.id]?.walking }));
    list.push({ id: "me", x: me.x, y: me.y, name: myName, label: place || "…", bubble: bubbles.me?.text, kind: settings.character, custom: settings.customCharacter || undefined, facing, walking, carrying: action ? undefined : carried ? lookOf(carried.sound) : undefined, action });
    return list;
  }, [others, motion, bubbles, me, myName, place, facing, walking, settings.character, settings.customCharacter, carried, action]);

  /** The speaker close enough to lift, if the hands are free. */
  const liftable = useMemo(() => {
    if (!canEdit || carryId || action) return null;
    return placed.map((speaker) => ({ speaker, gap: distance(speaker, me) })).filter((item) => item.gap <= PICK_UP_TILES).sort((a, b) => a.gap - b.gap)[0]?.speaker ?? null;
  }, [canEdit, carryId, action, placed, me]);

  const markers: Marker[] = [];
  if (liftable) markers.push({ id: "lift", x: liftable.x, y: liftable.y, offsetX: 66, offsetY: -34, content: <Btn small variant="mint" title={t("near.lift")} onPress={() => lift(liftable)} testID="speaker-lift" /> });
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

  // The settings card is prepared once and only redrawn when what it shows changes, not on every step.
  const settingsHandlers = useRef({ onSettings, changeName, togglePlay, logout, onExit, downloadNature, developer });
  settingsHandlers.current = { onSettings, changeName, togglePlay, logout, onExit, downloadNature, developer };
  const settingsOpen = panel === "settings";
  const loggedIn = !!(entry?.user ?? client.currentUser);
  const settingsCard = useMemo(
    () => (
      <SettingsCard
        client={client}
        open={settingsOpen}
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
    [settingsOpen, settings, entry?.user, online, myName, nameError, t, patch?.phase, client, loggedIn],
  );
  const lostText = online && link === "lost" ? t(enterError || "notice.lost") : online && link === "replaced" ? t("notice.replaced") : "";
  // While the connection is lost (or taken over), a lasting toast says so; it goes when the cause is gone.
  useEffect(() => {
    if (lostText) showToast({ id: "connection", text: lostText, kind: "message", seconds: null });
    else dismissToast("connection");
  }, [lostText]);
  useEffect(() => () => dismissToast("connection"), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.sky, flexDirection: wide ? "row" : "column" }}>
      <View style={{ flex: 1 }}>
        <Scene me={me} actors={actors} speakers={speakers} carriedId={carryId} markers={markers} onInput={(input) => (joystick.current = input)} />

        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 10, gap: 6 }}>
          <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <View pointerEvents="box-none" style={{ flex: 1, alignItems: "flex-start" }}>
              {canEdit && link === "online" && (carried ? <Btn small variant="danger" title={t("top.discard")} disabled={!!action} onPress={discard} testID="speaker-discard" /> : <Btn small variant="primary" title={t("top.create")} disabled={!!action || !!carryId} onPress={create} testID="speaker-create" />)}
            </View>
            {wide && <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}><GardenStatus
              title={t(online ? "status.public" : mode === "test" ? "status.test" : "status.mine") + (online && link === "online" ? " · " + t("status.people", { n: Object.keys(others).length + 1 }) : "")}
              detail={patch?.phase === "failed" ? t("patch.failed") : t("status.heard", { n: heard })}
              progress={patch?.phase === "downloading" ? (patch.totalBytes ? patch.doneBytes / patch.totalBytes : 0) : null}
              gaugeLabel={t("status.downloading")}
            /></View>}
            <View pointerEvents="box-none" style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
              <SoundButton compact={!wide} playing={playing} volume={settings.volume} onToggle={() => void togglePlay()} onVolume={(volume) => onSettings({ ...settings, volume })} />
              <IconBtn label={t("top.settings")} onPress={() => setPanel("settings")} testID="open-settings">
                <GearIcon />
              </IconBtn>
            </View>
          </View>
        </View>

        {online && link === "online" && !showEditor && (
          <View pointerEvents="box-none" style={{ position: "absolute", left: 10, right: 10, bottom: insets.bottom + 10, maxWidth: 520, gap: 6 }}>
            <ChatLog entries={chatLog} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              {entry?.canChat ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Input inputRef={chatInput} autoFocus={desktopChat} submitBehavior={desktopChat ? "submit" : undefined} label={t("chat.label")} placeholder={t("chat.placeholder")} value={draft} maxLength={CHAT_MAX_LENGTH} onChangeText={setDraft} onSubmit={sendChat} testID="chat-input" />
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
          />
        </View>
      )}

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
      {/* Kept mounted and laid out while closed, so it opens at once and fully drawn. */}
      <Modal hidden={panel !== "settings"} onClose={() => setPanel(null)}>
        {settingsCard}
      </Modal>
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
