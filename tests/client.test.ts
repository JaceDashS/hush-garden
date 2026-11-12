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
