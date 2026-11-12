import assert from "node:assert/strict";
import { test } from "node:test";
import { CARRY, actionAt, actionDuration, actionFrames } from "../src/domain/actions.ts";
import { CHARACTER_KINDS, STANDING, WALK_FRAMES, nextWalkFrame, normalizeCharacter, poseFor } from "../src/domain/characters.ts";
import { LANGUAGES, TEXTS, languageForLocale, normalizeLanguage, translate, type TextKey } from "../src/domain/text.ts";
import { checkName, isReservedName } from "../src/domain/names.ts";
import { CHAT_RANGE, cleanMessage, cueFor } from "../src/domain/chat.ts";
import { BAND_IDS, dbToY, equalizerResponse, flatEqualizer, graphFrequencies, handleOf, hzToX, moveBand, normalizeEqualizer, peakBoost, xToHz, yToDb } from "../src/domain/equalizer.ts";
import { BUILT_IN_PRESETS, addSpeaker, applyPreset, deletePreset, initialGarden, moveSpeaker, normalizeMyGarden, removeSpeaker, resetGarden, savePreset, updateSpeaker } from "../src/domain/garden.ts";
import { MAX_OSCILLATORS, MAX_SPEAKERS, REACH, WAVES, audibleCount, defaultSound, gainAt, loudnessAt, mixFor, normalizeSound, reachOf, waveShape, type Speaker } from "../src/domain/sound.ts";
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
  const levels = mixFor({ x: 10, y: 10 }, [speaker("a", 8, 10), speaker("b", 12, 10), speaker("far", 0, 0)]);
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
  const sound = normalizeSound({ volume: 9, radius: -1, noise: { color: "purple", level: 2 }, oscillators: [1, 2, 3, 4, 5], eq: { highpass: 1500, lowpass: 300 } });
  assert.equal(sound.volume, 1);
  assert.equal("radius" in sound, false);
  assert.equal(sound.noise.color, "brown");
  assert.equal(sound.oscillators.length, MAX_OSCILLATORS);
  assert.ok(sound.eq.lowpass >= sound.eq.highpass);
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

test("there are ten characters, each with a name, and unknown ones fall back to the first", () => {
  assert.equal(CHARACTER_KINDS.length, 10);
  assert.equal(new Set(CHARACTER_KINDS).size, 10);
  assert.ok(LANGUAGES.every((language) => CHARACTER_KINDS.every((kind) => translate(language, ("character." + kind) as TextKey))));
  assert.equal(normalizeCharacter("panda"), "panda");
  assert.equal(normalizeCharacter("dragon"), "bunny");
  assert.equal(normalizeCharacter(undefined), "bunny");
});

test("a walking character cycles through different pictures and a standing one keeps still", () => {
  const poses = Array.from({ length: WALK_FRAMES }, (_, frame) => poseFor(true, frame));
  assert.equal(new Set(poses.map((pose) => JSON.stringify(pose))).size, WALK_FRAMES);
  // The feet take turns: the left foot lifts on the first step and the right foot on the second.
  assert.ok(poses[0].leftFoot.y < 0 && poses[0].rightFoot.y === 0);
  assert.ok(poses[2].rightFoot.y < 0 && poses[2].leftFoot.y === 0);
  assert.ok(poses[0].bob < 0 && poses[1].bob === 0);
  assert.deepEqual(poseFor(true, WALK_FRAMES), poses[0]);
  assert.deepEqual(poseFor(false, 2), STANDING);
  let frame = 0;
  for (let i = 0; i < WALK_FRAMES; i++) frame = nextWalkFrame(frame);
  assert.equal(frame, 0);
});

const near = (actual: number, expected: number, tolerance: number) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + " is not within " + tolerance + " of " + expected);

test("a flat equalizer changes nothing in the middle and cuts the far ends", () => {
  const [low, mid, high] = equalizerResponse(flatEqualizer(), [5, 1000, 23000]);
  near(mid, 0, 0.1);
  assert.ok(low < -12 && high < -3);
});

test("each band shapes its own part of the curve", () => {
  const eq = { ...flatEqualizer(), lowShelf: { frequency: 200, gain: 9 }, bell: { frequency: 1000, gain: -12, q: 2 }, highShelf: { frequency: 4000, gain: 6 } };
  const [bass, shelfCorner, middle, treble] = equalizerResponse(eq, [40, 200, 1000, 12000]);
  near(bass, 9, 1);
  near(shelfCorner, 4.5, 1);
  near(middle, -12, 1);
  near(treble, 6, 1);
  const cut = equalizerResponse({ ...flatEqualizer(), highpass: 500, lowpass: 2000 }, [500, 1000, 2000, 8000]);
  near(cut[0], -3, 0.5);
  near(cut[2], -3, 0.5);
  assert.ok(cut[1] > -1 && cut[3] < -20);
});

test("graph positions convert both ways and stay on the graph", () => {
  near(xToHz(hzToX(440)), 440, 0.01);
  near(yToDb(dbToY(-6)), -6, 0.001);
  assert.equal(hzToX(1), 0);
  assert.equal(hzToX(99999), 1);
  const points = graphFrequencies(64);
  assert.equal(points.length, 64);
  near(points[0], 20, 0.001);
  near(points[63], 20000, 0.01);
});

test("dragging a band keeps every value in range and the cuts in order", () => {
  let eq = flatEqualizer();
  eq = moveBand(eq, "bell", 99999, 99);
  assert.deepEqual([eq.bell.frequency, eq.bell.gain], [8000, 12]);
  eq = moveBand(eq, "lowShelf", 1, -99);
  assert.deepEqual([eq.lowShelf.frequency, eq.lowShelf.gain], [40, -24]);
  eq = moveBand(eq, "lowpass", 300, 5);
  eq = moveBand(eq, "highpass", 1500, 5);
  assert.ok(eq.highpass <= eq.lowpass);
  assert.deepEqual(handleOf(eq, "lowpass"), { hz: eq.lowpass, db: 0 });
  assert.equal(BAND_IDS.length, 5);
  assert.equal(peakBoost(eq), 12);
  assert.equal(peakBoost(flatEqualizer()), 0);
});

test("the first sound format with separate filters is still read", () => {
  const eq = normalizeEqualizer({ low: 3, mid: { frequency: 2500, gain: -4, q: 1 }, high: -3 }, { highpass: 80, lowpass: 7000 });
  assert.deepEqual(eq, { highpass: 80, lowShelf: { frequency: 200, gain: 3 }, bell: { frequency: 2500, gain: -4, q: 1 }, highShelf: { frequency: 4000, gain: -3 }, lowpass: 7000 });
  assert.equal(normalizeSound({ filter: { highpass: 100, lowpass: 5000 } }).eq.lowpass, 5000);
  assert.deepEqual(normalizeEqualizer(null), flatEqualizer());
});

test("a carrying character keeps its arms up while its feet keep stepping", () => {
  const standing = poseFor(false, 0, true);
  assert.equal(standing.armsUp, true);
  assert.deepEqual(standing.leftFoot, STANDING.leftFoot);
  const step = poseFor(true, 0, true);
  assert.equal(step.armsUp, true);
  assert.ok(step.leftFoot.y < 0);
  assert.equal(poseFor(true, 0).armsUp, undefined);
});

test("a lifted speaker rises from the ground in front to overhead", () => {
  const start = actionAt("bunny", "lift", 0);
  const end = actionAt("bunny", "lift", actionDuration("bunny", "lift"));
  assert.ok(start.prop.y === 0 && start.prop.x > 0 && start.arms === "down");
  assert.deepEqual(end.prop, CARRY);
  assert.ok(end.arms === "up" && end.done);
  assert.deepEqual(actionFrames("bunny", "lift"), actionFrames("mouse", "lift"));
});

const settled = (moment: ReturnType<typeof actionAt>) => {
  const { hop, shiftX, tilt, squash, arm, open, sway } = moment.stance;
  return [hop, shiftX, tilt % 360, squash - 1, arm, open, sway].every((value) => Math.abs(value) < 1e-9) && moment.turn === 1;
};

test("making a speaker ends with it held overhead, for every character", () => {
  for (const kind of CHARACTER_KINDS) {
    const duration = actionDuration(kind, "create");
    assert.ok(duration >= 1000 && duration <= 2000, kind);
    const start = actionAt(kind, "create", 0);
    assert.ok(start.arms === "down" && !start.done, kind);
    const end = actionAt(kind, "create", duration);
    assert.deepEqual(end.prop, CARRY, kind);
    assert.ok(end.form === "speaker" && end.arms === "up" && end.done && settled(end), kind);
    assert.deepEqual(actionAt(kind, "create", duration + 500).prop, CARRY, kind);
  }
});

test("discarding starts from the held speaker and ends with nothing, for every character", () => {
  for (const kind of CHARACTER_KINDS) {
    const duration = actionDuration(kind, "discard");
    assert.ok(duration >= 1000 && duration <= 2000, kind);
    const start = actionAt(kind, "discard", 0);
    assert.deepEqual(start.prop, CARRY, kind);
    assert.ok(start.form === "speaker" && start.arms === "up", kind);
    const end = actionAt(kind, "discard", duration);
    assert.ok(end.prop.opacity === 0 && end.arms === "down" && end.done && settled(end), kind);
  }
});

test("every character makes and discards a speaker in its own way", () => {
  for (const name of ["create", "discard"] as const) {
    const scripts = CHARACTER_KINDS.map((kind) => JSON.stringify(actionFrames(kind, name)));
    assert.equal(new Set(scripts).size, CHARACTER_KINDS.length, name);
    for (const kind of CHARACTER_KINDS) {
      const times = actionFrames(kind, name).map((frame) => frame.t);
      assert.ok(times.every((time, index) => index === 0 || time > times[index - 1]), kind + " " + name);
    }
  }
});

test("an action glides between keyframes and shows its effects only briefly", () => {
  // The frog is out of sight at the top of its leap and lands holding the speaker.
  assert.ok(actionAt("frog", "create", 600).stance.hop > 300);
  const falling = actionAt("frog", "create", 900);
  assert.ok(falling.stance.hop > 0 && falling.stance.hop < 320 && Math.abs(falling.prop.y - (CARRY.y + falling.stance.hop)) < 1e-9);
  assert.ok(actionAt("pig", "create", 260).effects.some((effect) => effect.kind === "dirt" && effect.progress > 0 && effect.progress < 1));
  assert.equal(actionAt("pig", "create", 1500).effects.length, 0);
  // The chick turns around to watch its egg, which hatches into the speaker.
  assert.equal(actionAt("chick", "create", 900).turn, -1);
  assert.equal(actionAt("chick", "create", 900).form, "egg");
  assert.equal(actionAt("chick", "create", 1200).form, "speaker");
});

test("a louder speaker is heard farther away and a silent one is not heard", () => {
  assert.equal(reachOf({ volume: 0 }), REACH[0]);
  assert.equal(reachOf({ volume: 1 }), REACH[1]);
  assert.ok(reachOf({ volume: 0.9 }) > reachOf({ volume: 0.3 }));
  assert.equal(loudnessAt(0, { volume: 0.5 }), 0.5);
  assert.equal(loudnessAt(reachOf({ volume: 0.5 }), { volume: 0.5 }), 0);
  assert.ok(loudnessAt(9, { volume: 1 }) > 0);
  assert.equal(loudnessAt(9, { volume: 0.4 }), 0);
  assert.equal(audibleCount({ x: 10, y: 10 }, [speaker("near", 11, 10), speaker("far", 0, 0), speaker("mute", 10, 10, { volume: 0 })]), 1);
});

test("the default sound gets its low end from oscillator A and holds at most two oscillators", () => {
  const sound = defaultSound();
  assert.equal(sound.oscillators.length, 1);
  assert.ok(sound.oscillators[0].wave === "sine" && sound.oscillators[0].frequency <= 80 && sound.oscillators[0].level > 0);
  assert.equal("bass" in sound, false);
  assert.equal(MAX_OSCILLATORS, 2);
  // An explicit empty list stays empty: the player removed the oscillators.
  assert.equal(normalizeSound({ oscillators: [] }).oscillators.length, 0);
});

test("a stored bass drone becomes a sine oscillator of the same loudness", () => {
  const sound = normalizeSound({ bass: { frequency: 60, level: 0.3 }, oscillators: [{ wave: "square", frequency: 300, level: 0.4 }, { wave: "triangle", frequency: 500, level: 0.1 }] });
  assert.equal(sound.oscillators.length, 2);
  assert.deepEqual(sound.oscillators[0].wave, "sine");
  assert.equal(sound.oscillators[0].frequency, 60);
  // The drone played at 0.5 of its level and an oscillator plays at 0.3 of its level.
  near(sound.oscillators[0].level * 0.3, 0.3 * 0.5, 1e-9);
  assert.equal(sound.oscillators[1].wave, "square");
  assert.equal(normalizeSound({ bass: { frequency: 60, level: 0 } }).oscillators.length, 0);
  assert.equal(normalizeSound({ bass: { frequency: 60, level: 1 } }).oscillators[0].level, 1);
  // Normalising again changes nothing.
  assert.deepEqual(normalizeSound(sound), sound);
});

test("wave pictures stay in range and differ by wave", () => {
  const shapes = WAVES.map((wave) => waveShape(wave, 33));
  assert.ok(shapes.every((shape) => shape.length === 33 && shape.every((value) => value >= -1 && value <= 1)));
  assert.equal(new Set(shapes.map((shape) => shape.map((value) => value.toFixed(3)).join())).size, WAVES.length);
  near(waveShape("sine", 5)[1], 1, 1e-9);
  assert.equal(waveShape("square", 5)[3], -1);
  assert.equal(waveShape("sine", 9, 0, 2).length, 9);
  near(waveShape("sine", 9, 0, 2)[1], 1, 1e-9);
});

test("every text exists in every language and fills in its values", () => {
  const keys = Object.keys(TEXTS.ko) as TextKey[];
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(TEXTS[language]).sort(), [...keys].sort(), language);
    for (const key of keys) {
      assert.ok(TEXTS[language][key].trim(), language + " " + key);
      const marks = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();
      assert.equal(marks(TEXTS[language][key]), marks(TEXTS.ko[key]), language + " " + key);
    }
  }
  assert.equal(translate("en", "status.heard", { n: 2 }), "2 speakers heard");
  assert.equal(translate("ko", "status.heard", { n: 2 }), "들리는 스피커 2개");
  assert.equal(translate("ja", "osc.add", { name: "OSC B" }), "OSC B を追加");
});

test("the language follows the device and unknown values fall back", () => {
  assert.equal(languageForLocale("ja-JP"), "ja");
  assert.equal(languageForLocale("ko_KR"), "ko");
  assert.equal(languageForLocale("fr-FR"), "en");
  assert.equal(languageForLocale(undefined), "en");
  assert.equal(normalizeLanguage("ja"), "ja");
  assert.equal(normalizeLanguage("xx"), "ko");
  assert.equal(normalizeLanguage(null, "en"), "en");
});

test("character names are cleaned and limited", () => {
  assert.deepEqual(checkName("  Mina   Kim "), { ok: true, name: "Mina Kim" });
  assert.deepEqual(checkName("   "), { ok: false, problem: "empty" });
  assert.deepEqual(checkName(7), { ok: false, problem: "empty" });
  assert.deepEqual(checkName("x".repeat(17)), { ok: false, problem: "too_long" });
  assert.deepEqual(checkName("정원사".repeat(5) + "가"), { ok: true, name: "정원사".repeat(5) + "가" });
});

test("names that look like staff or the service are refused, ordinary words are not", () => {
  for (const name of ["Admin", "ADM1N", "a d m i n", "the_moderator", "관리자", "운 영 자", "GM", "jace-s", "Hush Garden", "@dmin", "0wner"]) assert.equal(isReservedName(name), true, name);
  for (const name of ["Gmail fan", "Modest", "Devon", "정원사", "ねこ", "Robot", "Guest"]) assert.equal(isReservedName(name), false, name);
  assert.deepEqual(checkName("Official Mina"), { ok: false, problem: "reserved" });
});
