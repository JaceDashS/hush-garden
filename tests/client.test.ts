import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMIT_KNEE, LIMIT_RANGE, limiterCurve, softClip } from "../src/audio/limiter.ts";
import { fillNoise, loopOffset } from "../src/audio/noise.ts";
import { runPatch, type PatchState, type SoundStore } from "../src/audio/patch.ts";
import type { SoundManifest } from "../src/audio/library.ts";
import { BEAT_JITTER, CHUNK_SECONDS, EXTRA_PEAK, FADE_SECONDS, LAYER_SECONDS, layerGain, nextBeat, nextLayers, type Layer } from "../src/audio/bed.ts";
import { lookOf } from "../src/domain/sound.ts";
import { RIPPLE_INTERVAL, RIPPLE_POOL, RIPPLE_SECONDS, firstRippleDelay, nextRippleInterval } from "../src/game/ripple.ts";
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
  assert.equal(lookOf(hello.speakers[0].sound), "brown");
  assert.deepEqual(parseServerMessage(JSON.stringify({ t: "rename", id: "p", name: "Momo" })), { t: "rename", id: "p", name: "Momo" });
  assert.equal(parseServerMessage(JSON.stringify({ t: "rename", id: "p" })), null);
  const moves = parseServerMessage(JSON.stringify({ t: "moves", moves: [{ id: "p", x: 1, y: 1 }, { id: "q", x: "a", y: 1 }] }));
  assert.ok(moves && moves.t === "moves" && moves.moves.length === 1);
});

test("settings fall back to defaults and keep valid values", () => {
  const device = deviceLanguage();
  assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS, language: device });
  assert.deepEqual(normalizeSettings({ volume: 7, cue: "loud", consent: "yes", character: "dragon", language: "xx", natureSounds: "maybe" }), { volume: 1, cue: "tone", consent: false, character: "bunny", name: "", language: device, natureSounds: "ask" });
  assert.deepEqual(normalizeSettings({ volume: 0.25, cue: "dip", consent: true, character: "panda", name: " Momo ", language: "ja", natureSounds: "no" }), { volume: 0.25, cue: "dip", consent: true, character: "panda", name: "Momo", language: "ja", natureSounds: "no" });
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

test("voices of one noise colour start at different points of the loop", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const offsets = Array.from({ length: 50 }, () => loopOffset(6, random));
  assert.ok(offsets.every((offset) => offset >= 0 && offset < 6), "inside the loop");
  assert.ok(new Set(offsets).size === offsets.length, "no two alike");
  assert.ok(offsets.some((offset) => offset > 3) && offsets.some((offset) => offset < 3), "spread over the loop");
  assert.equal(loopOffset(6, () => 0.999999999), 6 * 0.999999999);
  assert.equal(loopOffset(6, () => 1), 0);
});

test("speakers send their sound waves at an uneven pace", () => {
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const waits = Array.from({ length: 40 }, () => nextRippleInterval(random));
  assert.ok(waits.every((wait) => wait >= RIPPLE_INTERVAL[0] && wait <= RIPPLE_INTERVAL[1]), "within the range");
  assert.ok(new Set(waits).size === waits.length, "not one fixed period");
  assert.ok(Math.max(...waits) - Math.min(...waits) > 0.5, "spread over the range");
  assert.equal(nextRippleInterval(() => 2), RIPPLE_INTERVAL[1]);
  assert.ok(firstRippleDelay(() => 0.5) > 0 && firstRippleDelay(() => 1) === RIPPLE_INTERVAL[1]);
  // A ring is reused only after it has reached the edge, even when every wait is the shortest.
  assert.ok(RIPPLE_POOL * RIPPLE_INTERVAL[0] >= RIPPLE_SECONDS);
});

test("the limiter leaves quiet sound alone and keeps peaks below one", () => {
  for (const value of [0, 0.3, -0.5, LIMIT_KNEE]) assert.equal(softClip(value), value);
  assert.ok(softClip(1) < 1 && softClip(1) > 0.9, "a full-scale peak is only slightly rounded");
  assert.ok(softClip(1.41) < 1 && softClip(1.41) > softClip(1), "two equal noises summed stay below one and louder than one");
  assert.ok(softClip(LIMIT_RANGE) < 1);
  assert.equal(softClip(-1.41), -softClip(1.41));
  const curve = limiterCurve(1001);
  assert.equal(curve[500], 0);
  assert.ok(Math.abs(curve[1000] - softClip(LIMIT_RANGE)) < 1e-6);
  assert.ok(curve.every((value, index) => index === 0 || value >= curve[index - 1]), "never folds back");
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

test("a nature recording plays as a chain of random sections that never leaves a gap", () => {
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const chain: Layer[] = [];
  const extras: Layer[] = [];
  let previous: Layer | null = null;
  while (!previous || previous.start < 3600) {
    const [next, extra] = nextLayers(previous, 10, random);
    chain.push(next);
    if (extra) extras.push(extra);
    previous = next;
  }
  for (const layer of [...chain, ...extras]) {
    assert.ok(layer.chunk >= 0 && layer.chunk < 10 && Number.isInteger(layer.chunk));
    assert.ok(layer.offset >= 0 && layer.offset + layer.length <= CHUNK_SECONDS + 1e-9, "inside its chunk");
    assert.ok(layer.fadeIn > 0 && layer.fadeOut > 0 && layer.fadeIn + layer.fadeOut <= layer.length + 1e-9);
  }
  for (const layer of chain) assert.ok(layer.length >= LAYER_SECONDS[0] && layer.length <= LAYER_SECONDS[1]);
  // The chained layers keep a constant power: every moment after the first fade-in sums to 1.
  for (let t = FADE_SECONDS[1]; t < 3500; t += 0.37) {
    const power = chain.reduce((sum, layer) => sum + layerGain(layer, t) ** 2, 0);
    assert.ok(Math.abs(power - 1) < 1e-6, "power " + power + " at " + t);
  }
  // Sections differ and extra layers come now and then, quieter.
  assert.ok(new Set(chain.map((l) => l.chunk)).size >= 8);
  assert.ok(extras.length > chain.length * 0.15 && extras.length < chain.length * 0.45);
  assert.ok(extras.every((l) => l.peak === EXTRA_PEAK));
});

test("heartbeat beats follow the tempo with a little wander", () => {
  let seed = 5;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const next = nextBeat(t, 60, random);
    assert.ok(Math.abs(next - t - 1) <= BEAT_JITTER + 1e-9);
    t = next;
  }
  assert.ok(Math.abs(t - 200) < 2, "the average stays on tempo");
  assert.ok(Math.abs(nextBeat(0, 120, () => 0.5) - 0.5) < 1e-9);
});

/** A store in memory, with a switchable network, for the patch tests. */
function memoryStore(initial: Record<string, number> = {}, manifest: unknown = null) {
  const files = new Map(Object.entries(initial));
  const downloaded: string[] = [];
  let kept: Set<string> | null = null;
  let saved: unknown = manifest;
  const store: SoundStore = {
    has: async (path, bytes) => files.get(path) === bytes,
    download: async (url, path) => {
      if (url.includes("broken")) throw new Error("HTTP 500");
      downloaded.push(path);
      files.set(path, Number(url.split("#")[1] ?? 0));
    },
    source: async (path) => "file://" + path,
    prune: async (keep) => {
      kept = keep;
      for (const path of [...files.keys()]) if (!keep.has(path)) files.delete(path);
    },
    clear: async () => { files.clear(); saved = null; },
    readManifest: async () => saved,
    writeManifest: async (m) => { saved = m; },
  };
  return { store, files, downloaded, kept: () => kept, saved: () => saved };
}

const sample: SoundManifest = { version: "v2", totalBytes: 600, recordings: [
  { id: "fs-1", source: "rain", kind: "chunks", chunkSeconds: 60, files: [{ path: "fs-1/00.mp3", bytes: 100 }, { path: "fs-1/01.mp3", bytes: 200 }] },
  { id: "fs-9", source: "heartbeat", kind: "beats", files: [{ path: "fs-9/beat-0.wav", bytes: 300 }] },
] };

test("the sound patch downloads what is missing, reports progress and removes old files", async () => {
  const mem = memoryStore({ "fs-1/00.mp3": 100, "old/00.mp3": 50 });
  // The fake download stores the size the manifest expects, as a real download would.
  mem.store.download = async (url, path) => { mem.downloaded.push(path); mem.files.set(path, sample.recordings.flatMap((r) => r.files).find((f) => f.path === path)!.bytes); };
  const states: PatchState[] = [];
  const files = await runPatch("https://api.example/hush-garden/sounds/", mem.store, (s) => states.push(s), async () => true, async () => sample);
  assert.ok(files);
  assert.deepEqual(mem.downloaded.sort(), ["fs-1/01.mp3", "fs-9/beat-0.wav"]);
  assert.equal(states[0].phase, "checking");
  assert.deepEqual(states.at(-1), { phase: "ready", doneBytes: 600, totalBytes: 600, doneFiles: 3, totalFiles: 3 });
  // Progress only grows, and starts with the file already there.
  const downloading = states.filter((s) => s.phase === "downloading");
  assert.equal(downloading[0].doneBytes, 100);
  assert.ok(downloading.every((s, i) => i === 0 || s.doneBytes >= downloading[i - 1].doneBytes));
  assert.equal(mem.files.has("old/00.mp3"), false);
  assert.equal((mem.saved() as SoundManifest).version, "v2");
  assert.equal(await files!.source("fs-1/00.mp3"), "file://fs-1/00.mp3");
});

test("the sound patch works offline from a complete earlier download and fails without one", async () => {
  const offline = async () => { throw new Error("offline"); };
  const complete = memoryStore({ "fs-1/00.mp3": 100, "fs-1/01.mp3": 200, "fs-9/beat-0.wav": 300 }, sample);
  const states: PatchState[] = [];
  assert.ok(await runPatch("https://x/", complete.store, (s) => states.push(s), undefined, offline));
  assert.equal(states.at(-1)!.phase, "ready");
  assert.equal(complete.downloaded.length, 0);
  const nothing = memoryStore();
  const failed: PatchState[] = [];
  assert.equal(await runPatch("https://x/", nothing.store, (s) => failed.push(s), undefined, offline), null);
  assert.equal(failed.at(-1)!.phase, "failed");
});

test("a failed download leaves nature sources unavailable", async () => {
  const mem = memoryStore();
  const states: PatchState[] = [];
  assert.equal(await runPatch("https://broken/", mem.store, (s) => states.push(s), undefined, async () => sample), null);
  assert.equal(states.at(-1)!.phase, "failed");
  assert.equal(mem.saved(), null, "no manifest is saved for an incomplete download");
});

test("the sound patch asks before downloading and does nothing when declined", async () => {
  const mem = memoryStore({ "fs-1/00.mp3": 100 });
  const asked: number[] = [];
  const states: PatchState[] = [];
  assert.equal(await runPatch("https://x/", mem.store, (s) => states.push(s), async (bytes) => { asked.push(bytes); return false; }, async () => sample), null);
  assert.deepEqual(asked, [500], "asked once with the size still missing");
  assert.equal(mem.downloaded.length, 0);
  assert.deepEqual(states.map((s) => s.phase), ["checking", "asking", "declined"]);
  // Nothing is asked when everything is already there.
  const complete = memoryStore({ "fs-1/00.mp3": 100, "fs-1/01.mp3": 200, "fs-9/beat-0.wav": 300 });
  let questions = 0;
  assert.ok(await runPatch("https://x/", complete.store, () => undefined, async () => { questions++; return true; }, async () => sample));
  assert.equal(questions, 0);
});
