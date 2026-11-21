import type { CharacterKind } from "../domain/characters";
import type { SourceLook, Speaker } from "../domain/sound";
import type { SpeakerPreset } from "../domain/speakerPresets";

export interface User {
  id: string;
  username: string;
  mustChangePassword?: boolean;
  displayName?: string | null;
}

export interface CountryInfo {
  code: string;
  name: string;
}

export interface HushProfile {
  characterName: string;
  character: CharacterKind;
  customCharacter: string | null;
}

export interface SpeakerPresetList {
  presets: SpeakerPreset[];
  limit: number;
}

export interface PublicRoomSummary {
  id: string;
  name: string;
  hostName: string;
  hostCountry: CountryInfo;
  playerCount: number;
  maxPlayers: number;
  allowInteraction: boolean;
  allowGuestEdit: boolean;
  createdAt: number;
}

export interface RoomDetail extends PublicRoomSummary {
  code: string;
  visibility: "public" | "private";
  hostPeerId: string | null;
}

export interface RoomMember {
  peerId: string;
  name: string;
  place: string;
  country: CountryInfo;
  character: CharacterKind;
  custom?: string;
  muted: boolean;
  joinedAt: number;
  isGuest: boolean;
  carrying?: string;
  x?: number;
  y?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

/** Platform-specific HTTP layer. Web relies on browser cookies; native keeps the session in encrypted storage. */
export interface Transport {
  /** Sends a request to an API path such as `/auth/session`. A body makes it a POST. */
  send<T>(path: string, body?: unknown, account?: string): Promise<T>;
  /** Drops locally held credentials without contacting the server. */
  forget(): Promise<void>;
  /** Native: whether stored credentials exist. Web always returns true so the browser cookie is checked. */
  hasCredentials(): Promise<boolean>;
}

/** Result of entering the public garden or a P2P room. */
export interface Entry {
  /** Server-owned account nickname; empty uses the account display name. */
  characterName?: string;
  /** One-use ticket for the garden/room socket. */
  ticket: string;
  /** City-level place shown above the character. */
  place: string;
  /** Country resolved from coordinates or IP. */
  country?: CountryInfo;
  /** The character name the server accepted for this visit. */
  name: string;
  character?: CharacterKind;
  customCharacter?: string | null;
  user: { id: string; name: string } | null;
  canChat: boolean;
  canEdit: boolean;
}

export interface RoomEntryResponse {
  room: RoomDetail;
  code?: string;
  ticket: string;
  entry: Entry;
}

export interface RemotePlayer {
  id: string;
  name: string;
  place: string;
  character: CharacterKind;
  /** An approved character image of that player, drawn instead of `character` once loaded. */
  custom?: string;
  muted?: boolean;
  /** Speaker id currently held by this player, if any. */
  carrying?: string;
  x: number;
  y: number;
}

/** Messages the legacy garden socket sends. */
export type ServerMessage =
  | { t: "hello"; id: string; x: number; y: number; canChat: boolean; players: RemotePlayer[]; speakers: Speaker[] }
  | { t: "join"; player: RemotePlayer }
  | { t: "leave"; id: string }
  | { t: "rename"; id: string; name: string }
  | { t: "moves"; moves: { id: string; x: number; y: number }[] }
  | { t: "chat"; id: string; name: string; text: string; color?: string; x: number; y: number }
  | { t: "speakers"; speakers: Speaker[] }
  | { t: "hold"; playerId: string; id: string; facing?: 1 | -1 }
  | { t: "holdDenied"; id: string }
  | { t: "release"; playerId: string; id: string; x?: number; y?: number; facing?: 1 | -1 }
  | { t: "action"; playerId: string; name: "create" | "discard"; look: SourceLook; facing?: 1 | -1 }
  /** A player's character image was deleted: draw `character` from now on. */
  | { t: "look"; id: string; character: CharacterKind; custom?: string }
  | { t: "error"; error: string };

/** Messages exchanged over the P2P room signaling WebSocket. */
export type RoomServerMessage =
  | { t: "roomHello"; peerId: string; room: RoomDetail; members: RoomMember[]; speakers: Speaker[] }
  | { t: "peerJoined"; member: RoomMember }
  | { t: "peerLeft"; peerId: string; reason: "left" | "kicked" | "replaced" }
  | { t: "signal"; from: string; description?: unknown; candidate?: unknown }
  | { t: "roomUpdated"; room: RoomDetail }
  | { t: "hostChanged"; hostPeerId: string; hostCountry: CountryInfo }
  | { t: "peerRenamed"; peerId: string; name: string }
  | { t: "peerLook"; peerId: string; character: CharacterKind; custom?: string | null }
  | { t: "peerMuted"; peerId: string; muted: boolean }
  | { t: "hold"; playerId: string; id: string; facing?: 1 | -1 }
  | { t: "holdDenied"; id: string }
  | { t: "release"; playerId: string; id: string; x?: number; y?: number; facing?: 1 | -1 }
  | { t: "speakers"; speakers: Speaker[] }
  | { t: "error"; error: string };
