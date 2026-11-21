import { normalizeCharacter, type CharacterKind } from "../domain/characters";
import { normalizeSpeakers } from "../domain/garden";
import { isCharacterId } from "../domain/imageCharacters";
import type { Speaker } from "../domain/sound";
import type { Point } from "../domain/world";
import type { CountryInfo, RoomDetail, RoomMember, RoomServerMessage } from "./types";

export const REPLACED_CODE = 4001;
export const KICKED_CODE = 4002;
export const ADMIN_KICKED_CODE = 4003;

export function roomSocketUrl(apiOrigin: string, ticket: string): string {
  return apiOrigin.replace(/^http/, "ws") + "/hush-garden/room-socket?ticket=" + encodeURIComponent(ticket);
}

function toCountry(raw: unknown): CountryInfo {
  const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    code: typeof v.code === "string" && v.code ? v.code : "XX",
    name: typeof v.name === "string" && v.name ? v.name : "Unknown",
  };
}

function toRoomDetail(raw: unknown): RoomDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string" || typeof v.code !== "string") return null;
  return {
    id: v.id,
    code: v.code,
    name: v.name,
    visibility: v.visibility === "private" ? "private" : "public",
    hostPeerId: typeof v.hostPeerId === "string" ? v.hostPeerId : null,
    hostName: typeof v.hostName === "string" ? v.hostName : "",
    hostCountry: toCountry(v.hostCountry),
    playerCount: typeof v.playerCount === "number" ? v.playerCount : 0,
    maxPlayers: typeof v.maxPlayers === "number" ? v.maxPlayers : 8,
    allowInteraction: v.allowInteraction !== false,
    allowGuestEdit: v.allowGuestEdit === true,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
  };
}

function toRoomMember(raw: unknown): RoomMember | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.peerId !== "string") return null;
  return {
    peerId: v.peerId,
    name: typeof v.name === "string" ? v.name : "",
    place: typeof v.place === "string" ? v.place : "",
    country: toCountry(v.country),
    character: normalizeCharacter(v.character),
    ...(isCharacterId(v.custom) ? { custom: v.custom } : {}),
    muted: v.muted === true,
    joinedAt: typeof v.joinedAt === "number" ? v.joinedAt : 0,
    isGuest: v.isGuest === true,
    ...(typeof v.carrying === "string" && v.carrying ? { carrying: v.carrying } : {}),
  };
}

export function parseRoomServerMessage(text: string): RoomServerMessage | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  switch (m.t) {
    case "roomHello": {
      const room = toRoomDetail(m.room);
      if (typeof m.peerId !== "string" || !room || !Array.isArray(m.members)) return null;
      return {
        t: "roomHello",
        peerId: m.peerId,
        room,
        members: m.members.map(toRoomMember).filter((item): item is RoomMember => item !== null),
        speakers: normalizeSpeakers(m.speakers),
      };
    }
    case "peerJoined": {
      const member = toRoomMember(m.member);
      return member ? { t: "peerJoined", member } : null;
    }
    case "peerLeft":
      if (typeof m.peerId !== "string") return null;
      return {
        t: "peerLeft",
        peerId: m.peerId,
        reason: m.reason === "kicked" || m.reason === "replaced" ? m.reason : "left",
      };
    case "signal":
      if (typeof m.from !== "string") return null;
      return {
        t: "signal",
        from: m.from,
        ...(m.description !== undefined ? { description: m.description } : {}),
        ...(m.candidate !== undefined ? { candidate: m.candidate } : {}),
      };
    case "roomUpdated": {
      const room = toRoomDetail(m.room);
      return room ? { t: "roomUpdated", room } : null;
    }
    case "hostChanged":
      if (typeof m.hostPeerId !== "string") return null;
      return { t: "hostChanged", hostPeerId: m.hostPeerId, hostCountry: toCountry(m.hostCountry) };
    case "peerRenamed":
      return typeof m.peerId === "string" && typeof m.name === "string" ? { t: "peerRenamed", peerId: m.peerId, name: m.name } : null;
    case "peerLook":
      return typeof m.peerId === "string"
        ? { t: "peerLook", peerId: m.peerId, character: normalizeCharacter(m.character), custom: isCharacterId(m.custom) ? m.custom : null }
        : null;
    case "peerMuted":
      return typeof m.peerId === "string" ? { t: "peerMuted", peerId: m.peerId, muted: m.muted === true } : null;
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
        ...(typeof m.x === "number" && typeof m.y === "number" ? { x: m.x, y: m.y } : {}),
        ...(m.facing === 1 || m.facing === -1 ? { facing: m.facing } : {}),
      };
    case "speakers":
      return { t: "speakers", speakers: normalizeSpeakers(m.speakers) };
    case "error":
      return typeof m.error === "string" ? { t: "error", error: m.error } : null;
    default:
      return null;
  }
}

/** WebSocket connection to the P2P room signaling and metadata coordinator. */
export class RoomSocket {
  private socket: WebSocket | null = null;

  constructor(
    private readonly url: string,
    private readonly onMessage: (message: RoomServerMessage) => void,
    private readonly onClose: (code: number) => void,
  ) {}

  open(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onmessage = (event) => {
      const msg = typeof event.data === "string" ? parseRoomServerMessage(event.data) : null;
      if (msg) this.onMessage(msg);
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onClose(event.code);
    };
    socket.onerror = () => undefined;
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }

  signal(to: string, payload: { description?: unknown; candidate?: unknown }): void {
    this.sendJson({ t: "signal", to, ...payload });
  }

  updateSettings(patch: { maxPlayers?: number; allowInteraction?: boolean; allowGuestEdit?: boolean }): void {
    this.sendJson({ t: "updateSettings", ...patch });
  }

  kick(peerId: string): void {
    this.sendJson({ t: "kick", peerId });
  }

  transferHost(peerId: string): void {
    this.sendJson({ t: "transferHost", peerId });
  }

  rename(name: string): void {
    this.sendJson({ t: "rename", name });
  }

  look(character: CharacterKind, custom: string | null): void {
    this.sendJson({ t: "look", character, custom });
  }

  mute(muted: boolean): void {
    this.sendJson({ t: "mute", muted });
  }

  hold(id: string, facing?: 1 | -1): void {
    this.sendJson({ t: "hold", id, ...(facing ? { facing } : {}) });
  }

  release(id: string, spot?: Point, facing?: 1 | -1): void {
    this.sendJson({ t: "release", id, ...(spot ? { x: spot.x, y: spot.y } : {}), ...(facing ? { facing } : {}) });
  }

  saveSpeaker(speaker: Speaker): void {
    this.sendJson({ t: "saveSpeaker", speaker });
  }

  deleteSpeaker(id: string): void {
    this.sendJson({ t: "deleteSpeaker", id });
  }

  private sendJson(payload: object): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(payload));
  }
}
