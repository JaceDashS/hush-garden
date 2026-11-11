import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_RANGE, cleanMessage, cueFor } from "../src/domain/chat.ts";
import { BUILT_IN_PRESETS, addSpeaker, applyPreset, deletePreset, initialGarden, moveSpeaker, normalizeMyGarden, removeSpeaker, resetGarden, savePreset, updateSpeaker } from "../src/domain/garden.ts";
import { MAX_SPEAKERS, defaultSound, gainAt, mixFor, normalizeSound, type Speaker } from "../src/domain/sound.ts";
import { GARDEN_SIZE, joystickToInput, keysToInput, step, toGarden, toScreen } from "../src/domain/world.ts";

const speaker = (id: string, x: number, y: number, patch = {}): Speaker => ({ id, name: id, x, y, sound: { ...defaultSound(), ...patch } });

test("screen projection round-trips", () => {
  const point = toGarden(toScreen({ x: 3.5, y: 9.25 }));
  assert.ok(Math.abs(point.x - 3.5) < 1e-9 && Math.abs(point.y - 9.25) < 1e-9);
});

test("moves up the screen when up is pressed", () => {
  const start = { x: 10, y: 10 };
  const next = step(start, keysToInput(new Set(["ArrowUp"])), 0.1);
  assert.ok(toScreen(next).y < toScreen(start).y);
  assert.ok(Math.abs(toScreen(next).x - toScreen(start).x) < 1e-9);
});

test("moves right on screen when D is pressed and stays inside the garden", () => {
  let position = { x: 10, y: 10 };
  for (let i = 0; i < 400; i++) position = step(position, keysToInput(new Set(["d"])), 0.1);
  assert.ok(position.x <= GARDEN_SIZE && position.y >= 0);
  assert.ok(toScreen(position).x > toScreen({ x: 10, y: 10 }).x);
});

test("stands still without input and inside the joystick dead zone", () => {
  const start = { x: 5, y: 5 };
  assert.deepEqual(step(start, keysToInput(new Set()), 0.1), start);
  assert.deepEqual(joystickToInput(2, 2, 50), { x: 0, y: 0 });
});

test("joystick input never exceeds full speed", () => {
  const input = joystickToInput(300, 0, 50);
  assert.ok(Math.abs(Math.hypot(input.x, input.y) - 1) < 1e-9);
});

test("a speaker is loudest next to it and silent at its radius", () => {
  assert.equal(gainAt(0, 8), 1);
  assert.ok(gainAt(2, 8) > gainAt(6, 8));
  assert.equal(gainAt(8, 8), 0);
  assert.equal(gainAt(20, 8), 0);
});

test("two speakers in range are both heard", () => {
  const levels = mixFor({ x: 10, y: 10 }, [speaker("a", 8, 10), speaker("b", 12, 10), speaker("far", 0, 0, { radius: 2 })]);
  assert.ok(levels[0].gain > 0 && levels[1].gain > 0);
  assert.equal(levels[2].gain, 0);
});

test("overlapping speakers never exceed one full speaker", () => {
  const levels = mixFor({ x: 10, y: 10 }, [speaker("a", 10, 10, { volume: 1 }), speaker("b", 10, 10, { volume: 1 }), speaker("c", 10, 10, { volume: 1 })]);
  assert.ok(Math.sqrt(levels.reduce((sum, level) => sum + level.gain ** 2, 0)) <= 1 + 1e-9);
});

test("a speaker to the right on screen pans right", () => {
  const [level] = mixFor({ x: 10, y: 10 }, [speaker("a", 13, 7)]);
  assert.ok(level.pan > 0);
});

test("sound values are clamped and broken input falls back to defaults", () => {
  const sound = normalizeSound({ volume: 9, radius: -1, noise: { color: "purple", level: 2 }, oscillators: [1, 2, 3, 4, 5], filter: { highpass: 1500, lowpass: 300 } });
  assert.equal(sound.volume, 1);
  assert.equal(sound.radius, 2);
  assert.equal(sound.noise.color, "brown");
  assert.equal(sound.oscillators.length, 3);
  assert.ok(sound.filter.lowpass >= sound.filter.highpass);
  assert.deepEqual(normalizeSound(null), defaultSound());
});

test("speakers can be added, moved, edited and removed", () => {
  let speakers = addSpeaker([], { x: 3, y: 4 }, "s1");
  speakers = moveSpeaker(speakers, "s1", { x: 99, y: -5 });
  assert.ok(speakers[0].x <= GARDEN_SIZE && speakers[0].y >= 0);
  speakers = updateSpeaker(speakers, "s1", { name: "  Rain  ", sound: { ...defaultSound(), volume: 0.2 } });
  assert.equal(speakers[0].name, "Rain");
  assert.equal(speakers[0].sound.volume, 0.2);
  assert.deepEqual(removeSpeaker(speakers, "s1"), []);
});

test("a full garden refuses another speaker", () => {
  let speakers: Speaker[] = [];
  for (let i = 0; i < MAX_SPEAKERS + 3; i++) speakers = addSpeaker(speakers, { x: 5, y: 5 }, "s" + i);
  assert.equal(speakers.length, MAX_SPEAKERS);
});

test("user presets are saved, applied, deleted and reset", () => {
  let garden = initialGarden();
  garden = { ...garden, speakers: addSpeaker(garden.speakers, { x: 2, y: 2 }, "mine") };
  garden = savePreset(garden, "Night", "p1");
  garden = savePreset(garden, "Night", "p2");
  assert.equal(garden.presets.length, 1);
  garden = applyPreset(garden, BUILT_IN_PRESETS[1].id);
  assert.equal(garden.speakers.length, BUILT_IN_PRESETS[1].speakers.length);
  garden = applyPreset(garden, "p2");
  assert.ok(garden.speakers.some((item) => item.id === "mine"));
  assert.equal(deletePreset(garden, "p2").presets.length, 0);
  assert.deepEqual(resetGarden(), initialGarden());
});

test("broken stored gardens fall back to the initial garden", () => {
  assert.deepEqual(normalizeMyGarden("nonsense"), initialGarden());
  assert.deepEqual(normalizeMyGarden({ speakers: [{ id: "", x: 1, y: 1 }, { id: "ok", x: 1, y: 1 }], presets: [{ name: "no id" }] }).speakers.map((s) => s.id), ["ok"]);
});

test("chat cue is deeper when closer and absent out of range", () => {
  const near = cueFor({ x: 10, y: 10 }, { x: 11, y: 10 })!;
  const far = cueFor({ x: 10, y: 10 }, { x: 10 + CHAT_RANGE - 1, y: 10 })!;
  assert.ok(near.depth > far.depth && near.depth <= 1);
  assert.equal(cueFor({ x: 0, y: 0 }, { x: CHAT_RANGE + 1, y: 0 }), null);
});

test("chat cue points to the side the talker is on", () => {
  assert.ok(cueFor({ x: 10, y: 10 }, { x: 13, y: 7 })!.pan > 0);
  assert.ok(cueFor({ x: 10, y: 10 }, { x: 7, y: 13 })!.pan < 0);
});

test("chat messages are trimmed, limited and never empty", () => {
  assert.equal(cleanMessage("  hi\n there  "), "hi there");
  assert.equal(cleanMessage("   "), null);
  assert.equal(cleanMessage(5), null);
  assert.equal(cleanMessage("x".repeat(500))!.length, 200);
});
