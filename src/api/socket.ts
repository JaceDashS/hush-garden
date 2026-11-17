import { normalizeCharacter } from "../domain/characters";
import { isCharacterId } from "../domain/imageCharacters";
import { normalizeSpeakers } from "../domain/garden";
import type { SourceLook } from "../domain/sound";
import type { Point } from "../domain/world";
import type { ServerMessage } from "./types";

/** Position updates are sent at most this often. */
const MOVE_INTERVAL_MS = 100;

/** `wss://api.jace-s.com/hush-garden/socket?ticket=...` from the HTTPS API origin. */
export function socketUrl(apiOrigin: string, ticket: string): string {
  return apiOrigin.replace(/^http/, "ws") + "/hush-garden/socket?ticket=" + encodeURIComponent(ticket);
}

/** Checks the shape of a socket message; anything unexpected is dropped. */
export function parseServerMessage(text: string): ServerMessage | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  const isPoint = (v: Record<string, unknown>) => typeof v.x === "number" && typeof v.y === "number" && Number.isFinite(v.x) && Number.isFinite(v.y);
  const isPlayer = (v: unknown): boolean => !!v && typeof v === "object" && typeof (v as Record<string, unknown>).id === "string" && isPoint(v as Record<string, unknown>);
  switch (m.t) {
    case "hello":
      if (typeof m.id !== "string" || !isPoint(m) || !Array.isArray(m.players)) return null;
      return { t: "hello", id: m.id, x: m.x as number, y: m.y as number, canChat: m.canChat === true, players: m.players.filter(isPlayer).map(toPlayer), speakers: normalizeSpeakers(m.speakers) };
    case "join":
      return isPlayer(m.player) ? { t: "join", player: toPlayer(m.player) } : null;
    case "leave":
      return typeof m.id === "string" ? { t: "leave", id: m.id } : null;
    case "rename":
      return typeof m.id === "string" && typeof m.name === "string" ? { t: "rename", id: m.id, name: m.name } : null;
    case "moves":
      return Array.isArray(m.moves) ? { t: "moves", moves: m.moves.filter(isPlayer).map((v) => ({ id: v.id as string, x: v.x as number, y: v.y as number })) } : null;
    case "chat":
      if (typeof m.id !== "string" || typeof m.text !== "string" || !isPoint(m)) return null;
      return { t: "chat", id: m.id, name: typeof m.name === "string" ? m.name : "", text: m.text, x: m.x as number, y: m.y as number };
    case "speakers":
      return { t: "speakers", speakers: normalizeSpeakers(m.speakers) };
    case "hold":
      if (typeof m.playerId !== "string" || typeof m.id !== "string") return null;
      return { t: "hold", playerId: m.playerId, id: m.id, ...(m.facing === 1 || m.facing === -1 ? { facing: m.facing } : {}) };
    case "holdDenied":
      return typeof m.id === "string" ? { t: "holdDenied", id: m.id } : null;
    case "release":
      if (typeof m.playerId !== "string" || typeof m.id !== "string") return null;
      return {
        t: "release",
        playerId: m.playerId,
        id: m.id,
        ...(isPoint(m) ? { x: m.x as number, y: m.y as number } : {}),
        ...(m.facing === 1 || m.facing === -1 ? { facing: m.facing } : {}),
      };
    case "action":
      if (typeof m.playerId !== "string" || (m.name !== "create" && m.name !== "discard") || typeof m.look !== "string") return null;
      return { t: "action", playerId: m.playerId, name: m.name, look: m.look as SourceLook, ...(m.facing === 1 || m.facing === -1 ? { facing: m.facing } : {}) };
    case "look":
      return typeof m.id === "string" ? { t: "look", id: m.id, character: normalizeCharacter(m.character), ...(isCharacterId(m.custom) ? { custom: m.custom } : {}) } : null;
    case "error":
      return typeof m.error === "string" ? { t: "error", error: m.error } : null;
    default:
      return null;
  }
}

function toPlayer(value: unknown) {
  const v = value as Record<string, unknown>;
  return {
    id: v.id as string,
    name: typeof v.name === "string" ? v.name : "",
    place: typeof v.place === "string" ? v.place : "",
    character: normalizeCharacter(v.character),
    ...(isCharacterId(v.custom) ? { custom: v.custom } : {}),
    ...(typeof v.carrying === "string" && v.carrying ? { carrying: v.carrying } : {}),
    x: v.x as number,
    y: v.y as number,
  };
}

/** Close code the server sends when a newer visit from the same device replaced this one. */
export const REPLACED_CODE = 4001;

/** Connection to the shared garden. Reconnecting needs a new ticket, so the owner calls enter() again on close. */
export class GardenSocket {
  private socket: WebSocket | null = null;
  private lastMoveAt = 0;
  private pending: Point | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly onMessage: (message: ServerMessage) => void,
    /** Receives the close code; REPLACED_CODE means a newer visit from this device took over. */
    private readonly onClose: (code: number) => void,
  ) {}

  open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onmessage = (event) => {
      const message = typeof event.data === "string" ? parseServerMessage(event.data) : null;
      if (message) this.onMessage(message);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onClose(event.code);
    };
    socket.onerror = () => undefined;
  }

  /** Closes without calling onClose. */
  close(): void {
    const socket = this.socket;
    this.socket = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    socket?.close();
  }

  /** Reports the player's position; calls in between the send interval are merged into the latest one. */
  move(point: Point): void {
    this.pending = point;
    if (this.timer) return;
    const wait = Math.max(0, MOVE_INTERVAL_MS - (Date.now() - this.lastMoveAt));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.lastMoveAt = Date.now();
      if (this.pending) this.sendJson({ t: "move", x: this.pending.x, y: this.pending.y });
      this.pending = null;
    }, wait);
  }

  chat(text: string): void {
    this.sendJson({ t: "chat", text });
  }

  /** Asks the server to change the character name. An empty name returns to the account name. */
  rename(name: string): void {
    this.sendJson({ t: "rename", name });
  }

  /** Requests an exclusive hold on a public speaker before lifting it. */
  hold(id: string, facing?: 1 | -1): void {
    this.sendJson({ t: "hold", id, ...(facing ? { facing } : {}) });
  }

  /** Releases the currently held public speaker, optionally reporting its landing spot. */
  release(id: string, spot?: Point, facing?: 1 | -1): void {
    this.sendJson({ t: "release", id, ...(spot ? { x: spot.x, y: spot.y } : {}), ...(facing ? { facing } : {}) });
  }

  /** Broadcasts a create or discard animation to other visitors. */
  action(name: "create" | "discard", look: SourceLook, facing?: 1 | -1): void {
    this.sendJson({ t: "action", name, look, ...(facing ? { facing } : {}) });
  }

  private sendJson(payload: object): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(payload));
  }
}
