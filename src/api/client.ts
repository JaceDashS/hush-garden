import { normalizeCharacter, type CharacterKind } from "../domain/characters";
import { normalizeSpeakers } from "../domain/garden";
import { isCharacterId, normalizeCharacterList, type CharacterList } from "../domain/imageCharacters";
import type { Speaker, SpeakerSound } from "../domain/sound";
import { MAX_SPEAKER_PRESETS, normalizeSpeakerPresets } from "../domain/speakerPresets";
import {
  ApiError,
  type Entry,
  type HushProfile,
  type PublicRoomSummary,
  type RoomEntryResponse,
  type SpeakerPresetList,
  type Transport,
  type User,
} from "./types";

/** Account, profile, speaker preset, and P2P room lobby API. Requests run one at a time so session updates never race. */
export class HushClient {
  private tail: Promise<unknown> = Promise.resolve();
  private user: User | null = null;

  constructor(private transport: Transport) {}

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private async call<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await this.transport.send<T>(path, body);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.user = null;
        await this.transport.forget();
      }
      throw error;
    }
  }

  get currentUser(): User | null {
    return this.user;
  }

  /** Posts public Hush Garden feedback using the current account or a guest edit password. */
  submitFeedback(content: string, password: string): Promise<{ id: number }> {
    return this.serialize(() => {
      if (!content.trim() || (!this.user && !password.trim())) throw new Error("Feedback and guest password are required");
      return this.call("/comments", { content: content.trim(), sourceAppId: 12, ...(!this.user ? { userPassword: password } : {}) });
    });
  }

  /** Returns the signed-in user, or null when there is no valid session. */
  restore(): Promise<User | null> {
    return this.serialize(async () => {
      if (!(await this.transport.hasCredentials())) return null;
      try {
        this.user = (await this.call<{ user: User }>("/auth/session")).user;
        return this.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    });
  }

  /** Password login through the jace-s account API. The password is never stored. */
  login(username: string, password: string, remember: boolean): Promise<User> {
    return this.serialize(async () => {
      await this.transport.forget();
      this.user = (await this.call<{ user: User }>("/auth/login", { username: username.trim(), password, remember })).user;
      return this.user;
    });
  }

  /** Public Google configuration for browser and native buttons. */
  googleConfig(): Promise<{ enabled: boolean; clientId: string | null }> {
    return this.serialize(() => this.call("/auth/google/config"));
  }

  /** One-use nonce bound to the next Google credential. */
  googleChallenge(): Promise<string> {
    return this.serialize(async () => (await this.call<{ nonce: string }>("/auth/google/challenge", {})).nonce);
  }

  /** Exchanges a Google ID token (web only) for the account session. */
  googleLogin(credential: string, remember: boolean): Promise<User> {
    return this.serialize(async () => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      this.user = (await this.call<{ user: User }>("/auth/google", { credential, remember, timeZone })).user;
      return this.user;
    });
  }

  /** Native nonce for an explicit Android Google account selection. */
  nativeGoogleChallenge(): Promise<string> {
    return this.serialize(async () => (await this.call<{ nonce: string }>("/auth/google/native/challenge", {})).nonce);
  }

  /** Verifies the native credential and stores the existing account session through the native transport. */
  nativeGoogleLogin(credential: string, nonce: string, remember: boolean): Promise<User> {
    return this.serialize(async () => {
      this.user = null;
      await this.transport.forget();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await this.call<{ user: User }>("/auth/google/native", { credential, nonce, remember, timeZone });
      if (!await this.transport.hasCredentials()) throw new ApiError(401, "SESSION_NOT_SAVED");
      this.user = result.user;
      return result.user;
    });
  }

  /** Revokes the server session. A failure stays retryable instead of pretending the user signed out. */
  logout(): Promise<void> {
    return this.serialize(async () => {
      await this.call("/auth/logout", {});
      this.user = null;
      await this.transport.forget();
    });
  }

  /** Fetches the signed-in account's synced garden appearance and nickname. */
  getProfile(): Promise<HushProfile> {
    return this.serialize(async () => {
      const res = await this.call<Record<string, unknown>>("/hush-garden/profile");
      return {
        characterName: typeof res.characterName === "string" ? res.characterName : "",
        character: normalizeCharacter(res.character),
        customCharacter: isCharacterId(res.customCharacter) ? res.customCharacter : null,
      };
    });
  }

  /** Saves the signed-in account's selected drawn/custom character for cross-device sync. */
  saveProfile(character: CharacterKind, customCharacter: string | null): Promise<HushProfile> {
    return this.serialize(async () => {
      const res = await this.call<Record<string, unknown>>("/hush-garden/profile", {
        character,
        customCharacter: customCharacter || null,
      });
      return {
        characterName: typeof res.characterName === "string" ? res.characterName : "",
        character: normalizeCharacter(res.character),
        customCharacter: isCharacterId(res.customCharacter) ? res.customCharacter : null,
      };
    });
  }

  /** Lists the signed-in account's personal speaker sound presets (up to 5). */
  listSpeakerPresets(): Promise<SpeakerPresetList> {
    return this.serialize(async () => {
      const res = await this.call<Record<string, unknown>>("/hush-garden/presets");
      return {
        presets: normalizeSpeakerPresets(res.presets),
        limit: typeof res.limit === "number" ? res.limit : MAX_SPEAKER_PRESETS,
      };
    });
  }

  /** Saves or updates one personal speaker sound preset for the signed-in account. */
  saveSpeakerPreset(input: { id?: string; name: string; sound: SpeakerSound }): Promise<SpeakerPresetList> {
    return this.serialize(async () => {
      const res = await this.call<Record<string, unknown>>("/hush-garden/presets/save", input);
      return {
        presets: normalizeSpeakerPresets(res.presets),
        limit: typeof res.limit === "number" ? res.limit : MAX_SPEAKER_PRESETS,
      };
    });
  }

  /** Deletes one personal speaker sound preset for the signed-in account. */
  deleteSpeakerPreset(id: string): Promise<SpeakerPresetList> {
    return this.serialize(async () => {
      const res = await this.call<Record<string, unknown>>("/hush-garden/presets/delete", { id });
      return {
        presets: normalizeSpeakerPresets(res.presets),
        limit: typeof res.limit === "number" ? res.limit : MAX_SPEAKER_PRESETS,
      };
    });
  }

  /** Lists currently open public P2P rooms. */
  listRooms(): Promise<PublicRoomSummary[]> {
    return this.serialize(async () => {
      const res = await this.call<{ rooms?: PublicRoomSummary[] }>("/hush-garden/rooms");
      return Array.isArray(res.rooms) ? res.rooms : [];
    });
  }

  /** Creates a new P2P room (signed-in users only) and returns its room metadata and join ticket. */
  createRoom(params: {
    coordinates: { latitude: number; longitude: number } | null;
    name: string;
    visibility: "public" | "private";
    maxPlayers: number;
    allowInteraction: boolean;
    allowGuestEdit: boolean;
    character: CharacterKind;
    customCharacter?: string;
    deviceId?: string;
  }): Promise<RoomEntryResponse> {
    const { coordinates, customCharacter, deviceId, ...rest } = params;
    return this.serialize(() =>
      this.call<RoomEntryResponse>("/hush-garden/rooms/create", {
        consent: true,
        ...rest,
        ...(customCharacter ? { customCharacter } : {}),
        ...(deviceId ? { deviceId } : {}),
        ...(coordinates ?? {}),
      }),
    );
  }

  /** Joins an existing P2P room by room id or invite code. */
  joinRoom(params: {
    coordinates: { latitude: number; longitude: number } | null;
    roomId?: string;
    code?: string;
    character: CharacterKind;
    customCharacter?: string;
    deviceId?: string;
  }): Promise<RoomEntryResponse> {
    const { coordinates, customCharacter, deviceId, ...rest } = params;
    return this.serialize(() =>
      this.call<RoomEntryResponse>("/hush-garden/rooms/join", {
        consent: true,
        ...rest,
        ...(customCharacter ? { customCharacter } : {}),
        ...(deviceId ? { deviceId } : {}),
        ...(coordinates ?? {}),
      }),
    );
  }

  /**
   * Enters the legacy public garden.
   */
  enter(coordinates: { latitude: number; longitude: number } | null, character: CharacterKind, name: string, deviceId?: string, customCharacter?: string): Promise<Entry> {
    return this.serialize(() => this.call<Entry>("/hush-garden/enter", { consent: true, character, name, ...(customCharacter ? { customCharacter } : {}), ...(deviceId ? { deviceId } : {}), ...(coordinates ?? {}) }));
  }

  /** The account's character images with their review state, and whether it may upload. Needs a login. */
  myCharacters(): Promise<CharacterList> {
    return this.serialize(async () => normalizeCharacterList(await this.call<unknown>("/hush-garden/characters/mine")));
  }

  /** Sends an image map (base64 PNG) for review. Needs the upload permission. Returns the new list. */
  uploadCharacter(name: string, png: string): Promise<CharacterList> {
    return this.serialize(async () => {
      const result = await this.call<{ characters: unknown }>("/hush-garden/characters/upload", { name: name.trim(), png });
      return normalizeCharacterList({ ...(await this.call<Record<string, unknown>>("/hush-garden/characters/mine")), characters: result.characters });
    });
  }

  /** Deletes one of the account's characters. Returns the new list. */
  deleteCharacter(id: string): Promise<CharacterList> {
    return this.serialize(async () => {
      await this.call("/hush-garden/characters/delete", { id });
      return normalizeCharacterList(await this.call<unknown>("/hush-garden/characters/mine"));
    });
  }

  /** Creates or replaces a public speaker. Needs the edit permission. Returns the new layout. */
  saveSpeaker(speaker: Speaker): Promise<Speaker[]> {
    return this.serialize(async () => normalizeSpeakers((await this.call<{ speakers: unknown }>("/hush-garden/speakers/save", { speaker })).speakers));
  }

  /** Removes a public speaker. Needs the edit permission. Returns the new layout. */
  deleteSpeaker(id: string): Promise<Speaker[]> {
    return this.serialize(async () => normalizeSpeakers((await this.call<{ speakers: unknown }>("/hush-garden/speakers/delete", { id })).speakers));
  }
}
