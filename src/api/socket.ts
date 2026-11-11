import { normalizeCharacter } from "../domain/characters";
import { normalizeSpeakers } from "../domain/garden";
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
    case "moves":
      return Array.isArray(m.moves) ? { t: "moves", moves: m.moves.filter(isPlayer).map((v) => ({ id: v.id as string, x: v.x as number, y: v.y as number })) } : null;
    case "chat":
      if (typeof m.id !== "string" || typeof m.text !== "string" || !isPoint(m)) return null;
      return { t: "chat", id: m.id, name: typeof m.name === "string" ? m.name : "", text: m.text, x: m.x as number, y: m.y as number };
    case "speakers":
      return { t: "speakers", speakers: normalizeSpeakers(m.speakers) };
    case "error":
      return typeof m.error === "string" ? { t: "error", error: m.error } : null;
    default:
      return null;
  }
}

function toPlayer(value: unknown) {
  const v = value as Record<string, unknown>;
  return { id: v.id as string, name: typeof v.name === "string" ? v.name : "", place: typeof v.place === "string" ? v.place : "", character: normalizeCharacter(v.character), x: v.x as number, y: v.y as number };
}

/** Connection to the shared garden. Reconnecting needs a new ticket, so the owner calls enter() again on close. */
export class GardenSocket {
  private socket: WebSocket | null = null;
  private lastMoveAt = 0;
  private pending: Point | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly url: string,
    private readonly onMessage: (message: ServerMessage) => void,
    private readonly onClose: () => void,
  ) {}

  open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onmessage = (event) => {
      const message = typeof event.data === "string" ? parseServerMessage(event.data) : null;
      if (message) this.onMessage(message);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onClose();
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

  private sendJson(payload: object): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(payload));
  }
}
