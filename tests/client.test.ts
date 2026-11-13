import assert from "node:assert/strict";
import { test } from "node:test";
import { fillNoise } from "../src/audio/noise.ts";
import { parseServerMessage, socketUrl } from "../src/api/socket.ts";
import { roundCoordinate } from "../src/coordinates.ts";
import { DEFAULT_SETTINGS, deviceLanguage, normalizeSettings } from "../src/settings.ts";

test("socket address uses wss for an https API origin and escapes the ticket", () => {
  assert.equal(socketUrl("https://api.jace-s.com", "a b"), "wss://api.jace-s.com/hush-garden/socket?ticket=a%20b");
  assert.equal(socketUrl("http://localhost:3100", "t"), "ws://localhost:3100/hush-garden/socket?ticket=t");
});

test("server messages are validated and unknown ones are dropped", () => {
  assert.equal(parseServerMessage("not json"), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "launch" })), null);
  assert.equal(parseServerMessage(JSON.stringify({ t: "chat", id: "a", text: 5, x: 1, y: 1 })), null);
  const hello = parseServerMessage(JSON.stringify({ t: "hello", id: "me", x: 1, y: 2, canChat: true, players: [{ id: "p", x: 3, y: 4, place: "Seoul, South Korea", character: "fox" }, { id: 9 }], speakers: [{ id: "s", x: 1, y: 1 }, "junk"] }));
  assert.ok(hello && hello.t === "hello");
  assert.equal(hello.players.length, 1);
  assert.equal(hello.players[0].place, "Seoul, South Korea");
  assert.equal(hello.players[0].character, "fox");
  const joined = parseServerMessage(JSON.stringify({ t: "join", player: { id: "q", x: 1, y: 1, character: "dragon" } }));
  assert.ok(joined && joined.t === "join" && joined.player.character === "bunny");
  assert.equal(hello.speakers.length, 1);
  assert.equal(hello.speakers[0].sound.noise.color, "brown");
  assert.deepEqual(parseServerMessage(JSON.stringify({ t: "rename", id: "p", name: "Momo" })), { t: "rename", id: "p", name: "Momo" });
  assert.equal(parseServerMessage(JSON.stringify({ t: "rename", id: "p" })), null);
  const moves = parseServerMessage(JSON.stringify({ t: "moves", moves: [{ id: "p", x: 1, y: 1 }, { id: "q", x: "a", y: 1 }] }));
  assert.ok(moves && moves.t === "moves" && moves.moves.length === 1);
});

test("settings fall back to defaults and keep valid values", () => {
  const device = deviceLanguage();
  assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS, language: device });
  assert.deepEqual(normalizeSettings({ volume: 7, cue: "loud", consent: "yes", character: "dragon", language: "xx" }), { volume: 1, cue: "tone", consent: false, character: "bunny", name: "", language: device });
  assert.deepEqual(normalizeSettings({ volume: 0.25, cue: "dip", consent: true, character: "panda", name: " Momo ", language: "ja" }), { volume: 0.25, cue: "dip", consent: true, character: "panda", name: "Momo", language: "ja" });
  assert.equal(normalizeSettings({ name: "admin" }).name, "");
});

test("coordinates are rounded to about one kilometre before leaving the device", () => {
  assert.equal(roundCoordinate(37.566535), 37.57);
  assert.equal(roundCoordinate(-126.97796), -126.98);
});

test("noise loops stay within range and brown noise loops without a jump", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const color of ["white", "pink", "brown"] as const) {
    const data = new Float32Array(48000);
    fillNoise(color, data, random);
    assert.ok(data.every((value) => Math.abs(value) <= 1), color + " stays within range");
    assert.ok(data.some((value) => Math.abs(value) > 0.05), color + " is not silent");
  }
  const brown = new Float32Array(48000);
  fillNoise("brown", brown, random);
  assert.ok(Math.abs(brown[brown.length - 1] - brown[0]) < 0.02);
});
import { HushClient } from "../src/api/client.ts";
import { createNativeTransport } from "../src/api/transport.ts";
import { signInWithNativeGoogle, type NativeGoogleProvider } from "../src/components/nativeGoogleFlow.ts";

test("native Google exchange saves the account session and reuses CSRF for logout", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  let saved: string | null = null;
  const store = { read: async () => saved, write: async (value: string | null) => { saved = value; } };
  const replies = [
    new Response(JSON.stringify({ nonce: "a".repeat(64) }), { status: 200 }),
    new Response(JSON.stringify({ user: { id: "google-user", username: "garden" } }), {
      status: 200, headers: [["set-cookie", "session=native-session; Path=/"], ["set-cookie", "csrf=native-csrf; Path=/"]],
    }),
    new Response(null, { status: 204 }),
  ];
  const send = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const reply = replies.shift();
    assert.ok(reply);
    return reply;
  }) as typeof fetch;
  const client = new HushClient(createNativeTransport("https://api.jace-s.com", store, send));
  const nonce = await client.nativeGoogleChallenge();
  assert.equal((await client.nativeGoogleLogin("synthetic-token", nonce, false)).id, "google-user");
  assert.equal(client.currentUser?.id, "google-user");
  assert.equal(calls[0].url, "https://api.jace-s.com/auth/google/native/challenge");
  assert.equal(calls[1].url, "https://api.jace-s.com/auth/google/native");
  const payload = JSON.parse(String(calls[1].init.body));
  assert.equal(payload.nonce, nonce);
  assert.equal(payload.remember, false);
  assert.equal(payload.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
  assert.equal(JSON.parse(saved!).session, "native-session");
  assert.equal((calls[1].init.headers as Record<string, string>).Origin, undefined);
  await client.logout();
  assert.equal((calls[2].init.headers as Record<string, string>)["x-csrf-token"], "native-csrf");
  assert.equal(saved, null);
});

test("native Google refuses login when the credential response did not save a session", async () => {
  const client = new HushClient({
    hasCredentials: async () => false, forget: async () => undefined,
    send: async <T>() => ({ user: { id: "unsaved", username: "garden" } }) as T,
  });
  await assert.rejects(client.nativeGoogleLogin("synthetic-token", "b".repeat(64), true), /SESSION_NOT_SAVED/);
  assert.equal(client.currentUser, null);
});

test("native picker cancellation and stale results do not exchange; retry uses a fresh nonce", async () => {
  let sequence = 0;
  let credential: string | null = null;
  let live = true;
  const exchanges: { credential: string; nonce: string; remember: boolean }[] = [];
  const configs: { webClientId: string; nonce: string; autoSelectOnSignIn: boolean }[] = [];
  const client = {
    googleConfig: async () => ({ enabled: true, clientId: "public-web-client" }),
    nativeGoogleChallenge: async () => String(++sequence).padStart(64, "0"),
    nativeGoogleLogin: async (token: string, nonce: string, remember: boolean) => {
      exchanges.push({ credential: token, nonce, remember });
      return { id: "signed-in" };
    },
  };
  const provider: NativeGoogleProvider = {
    checkPlayServices: async () => true,
    configure: (config) => { configs.push(config); },
    pickAccount: async () => credential,
  };
  assert.equal(await signInWithNativeGoogle(client, provider, true), null);
  assert.equal(exchanges.length, 0);
  credential = "synthetic-token";
  assert.deepEqual(await signInWithNativeGoogle(client, provider, false), { id: "signed-in" });
  assert.equal(exchanges[0].remember, false);
  assert.notEqual(configs[0].nonce, configs[1].nonce);
  assert.equal(configs[1].autoSelectOnSignIn, false);
  provider.pickAccount = async () => { live = false; return "stale-token"; };
  assert.equal(await signInWithNativeGoogle(client, provider, true, () => live), null);
  assert.equal(exchanges.length, 1);
});

test("disabled native Google sign in never opens the account picker", async () => {
  const forbidden = async (): Promise<never> => { throw Error("must not run"); };
  await assert.rejects(signInWithNativeGoogle({
    googleConfig: async () => ({ enabled: false, clientId: null }),
    nativeGoogleChallenge: forbidden, nativeGoogleLogin: forbidden,
  }, { checkPlayServices: forbidden, configure: () => { throw Error("must not configure"); }, pickAccount: forbidden }, true), /GOOGLE_NOT_CONFIGURED/);
});
