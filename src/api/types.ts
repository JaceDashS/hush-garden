import type { CharacterKind } from "../domain/characters";
import type { Speaker } from "../domain/sound";

export interface User {
  id: string;
  username: string;
  mustChangePassword?: boolean;
  displayName?: string | null;
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

/** Result of entering the public garden. */
export interface Entry {
  /** Server-owned account nickname; empty uses the account display name. */
  characterName?: string;
  /** One-use ticket for the garden socket. */
  ticket: string;
  /** City-level place shown above the character. */
  place: string;
  /** The character name the server accepted for this visit. */
  name: string;
  user: { id: string; name: string } | null;
  canChat: boolean;
  canEdit: boolean;
}

export interface RemotePlayer {
  id: string;
  name: string;
  place: string;
  character: CharacterKind;
  x: number;
  y: number;
}

/** Messages the garden socket sends. */
export type ServerMessage =
  | { t: "hello"; id: string; x: number; y: number; canChat: boolean; players: RemotePlayer[]; speakers: Speaker[] }
  | { t: "join"; player: RemotePlayer }
  | { t: "leave"; id: string }
  | { t: "rename"; id: string; name: string }
  | { t: "moves"; moves: { id: string; x: number; y: number }[] }
  | { t: "chat"; id: string; name: string; text: string; x: number; y: number }
  | { t: "speakers"; speakers: Speaker[] }
  | { t: "error"; error: string };
