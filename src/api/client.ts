import type { CharacterKind } from "../domain/characters";
import { normalizeSpeakers } from "../domain/garden";
import type { Speaker } from "../domain/sound";
import { ApiError, type Entry, type Transport, type User } from "./types";

/** Account and public garden API. Requests run one at a time so session updates never race. */
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

  /**
   * Enters the public garden. `consent` must be true. Coordinates are optional and already rounded by the
   * caller; without them the server uses the IP region. The server keeps only the place name.
   * `character` is the picture other players see and `name` the character name; an empty or refused name
   * becomes the account name or "Guest", and the accepted one comes back in the result.
   */
  enter(coordinates: { latitude: number; longitude: number } | null, character: CharacterKind, name: string, deviceId?: string): Promise<Entry> {
    return this.serialize(() => this.call<Entry>("/hush-garden/enter", { consent: true, character, name, ...(deviceId ? { deviceId } : {}), ...(coordinates ?? {}) }));
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
