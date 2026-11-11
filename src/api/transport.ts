import { apiUrl, readResponse } from "./http";
import type { Transport } from "./types";

export interface SessionStore {
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
}

interface Credentials {
  session: string;
  csrf: string;
}

/**
 * Native transport. The app cannot use browser cookies, so it captures the `session` and `csrf` cookies from
 * responses, keeps them in the encrypted store and sends them explicitly. Credentials never appear in URLs or logs.
 */
export function createNativeTransport(origin: string, store: SessionStore, send: typeof fetch = fetch): Transport {
  let credentials: Credentials | null = null;
  let loaded = false;

  async function load() {
    if (loaded) return;
    loaded = true;
    const saved = await store.read();
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as Partial<Credentials>;
      if (typeof value.session === "string" && typeof value.csrf === "string") credentials = { session: value.session, csrf: value.csrf };
      else await store.write(null);
    } catch {
      await store.write(null);
    }
  }

  return {
    async hasCredentials() {
      await load();
      return credentials !== null;
    },
    async forget() {
      loaded = true;
      credentials = null;
      await store.write(null);
    },
    async send<T>(path: string, body?: unknown, account?: string): Promise<T> {
      await load();
      const headers: Record<string, string> = { Accept: "application/json" };
      if (credentials) {
        headers.Cookie = "session=" + encodeURIComponent(credentials.session) + "; csrf=" + encodeURIComponent(credentials.csrf);
        if (body !== undefined) headers["x-csrf-token"] = credentials.csrf;
      }
      if (account) headers["x-companion-user"] = account;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const response = await send(apiUrl(origin, path), {
        method: body === undefined ? "GET" : "POST",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
      const next: Partial<Credentials> = { ...credentials };
      const raw = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
      const cookies = raw.length ? raw : (response.headers.get("set-cookie") ?? "").split(/,(?=\s*(?:session|csrf)=)/);
      for (const cookie of cookies) {
        const match = /^\s*(session|csrf)=([^;]*)/.exec(cookie);
        if (match) next[match[1] as keyof Credentials] = decodeURIComponent(match[2]);
      }
      if (next.session && next.csrf && (next.session !== credentials?.session || next.csrf !== credentials?.csrf)) {
        credentials = { session: next.session, csrf: next.csrf };
        await store.write(JSON.stringify(credentials));
      }
      return readResponse<T>(response);
    },
  };
}

/** Default transport for Android and iOS, backed by the platform's encrypted storage. */
export function createTransport(origin: string): Transport {
  // Loaded lazily so tests and the web bundle never import the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  const key = "hush-garden-session";
  return createNativeTransport(origin, {
    read: () => SecureStore.getItemAsync(key),
    write: (value) => (value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value)),
  });
}
