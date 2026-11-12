/** Speaker layout editing and presets. Used by the public garden editor and by the private offline garden. */
import { flatEqualizer } from "./equalizer";
import { MAX_SPEAKERS, defaultSound, normalizeSound, type Speaker, type SpeakerSound } from "./sound";
import { GARDEN_SIZE, clampToGarden, type Point } from "./world";

export interface Preset {
  id: string;
  name: string;
  speakers: Speaker[];
}

/** Everything the private garden keeps on the device. */
export interface MyGarden {
  speakers: Speaker[];
  /** Presets the user saved. Built-in presets are not stored. */
  presets: Preset[];
}

const sound = (patch: Partial<SpeakerSound>): SpeakerSound => normalizeSound({ ...defaultSound(), ...patch });
const eq = (patch: Partial<SpeakerSound["eq"]>): SpeakerSound["eq"] => ({ ...flatEqualizer(), ...patch });
const mid = GARDEN_SIZE / 2;

/** Presets shipped with the app. The first one is the garden a new user starts with. */
export const BUILT_IN_PRESETS: readonly Preset[] = [
  {
    id: "builtin-meadow",
    name: "Brown Meadow",
    speakers: [
      { id: "meadow-1", name: "Brown", x: mid - 4, y: mid, sound: sound({ noise: { color: "brown", level: 0.85 }, oscillators: [{ wave: "sine", frequency: 55, level: 0.6 }] }) },
      { id: "meadow-2", name: "Pink", x: mid + 4, y: mid - 3, sound: sound({ noise: { color: "pink", level: 0.7 }, oscillators: [{ wave: "sine", frequency: 60, level: 0.4 }] }) },
      { id: "meadow-3", name: "White", x: mid + 2, y: mid + 5, sound: sound({ noise: { color: "white", level: 0.55 }, oscillators: [{ wave: "sine", frequency: 50, level: 0.5 }], eq: eq({ lowpass: 9000 }) }) },
    ],
  },
  {
    id: "builtin-rain",
    name: "White Rain",
    speakers: [
      { id: "rain-1", name: "Rain", x: mid, y: mid, sound: sound({ volume: 0.9, noise: { color: "white", level: 0.7 }, oscillators: [{ wave: "sine", frequency: 48, level: 0.5 }], eq: eq({ lowShelf: { frequency: 200, gain: 3 }, bell: { frequency: 2500, gain: -4, q: 1 }, highShelf: { frequency: 4000, gain: -3 } }) }) },
      { id: "rain-2", name: "Thunder", x: mid - 6, y: mid + 6, sound: sound({ volume: 0.6, noise: { color: "brown", level: 0.9 }, oscillators: [{ wave: "sine", frequency: 40, level: 1 }], eq: eq({ lowpass: 1200 }) }) },
    ],
  },
  {
    id: "builtin-focus",
    name: "Deep Focus",
    speakers: [
      { id: "focus-1", name: "Hum", x: mid - 3, y: mid - 3, sound: sound({ noise: { color: "brown", level: 0.6 }, oscillators: [{ wave: "sine", frequency: 60, level: 0.8 }, { wave: "triangle", frequency: 120, level: 0.15 }] }) },
      { id: "focus-2", name: "Air", x: mid + 4, y: mid + 3, sound: sound({ noise: { color: "pink", level: 0.75 }, oscillators: [{ wave: "sine", frequency: 52, level: 0.55 }], eq: eq({ highpass: 80, lowpass: 7000 }) }) },
    ],
  },
];

const copy = (speakers: readonly Speaker[]): Speaker[] => speakers.map((speaker) => ({ ...speaker, sound: normalizeSound(speaker.sound) }));

/** The garden a first-time user sees. */
export function initialGarden(): MyGarden {
  return { speakers: copy(BUILT_IN_PRESETS[0].speakers), presets: [] };
}

/** Validates one stored or received speaker; returns null when it has no usable id or position. */
export function normalizeSpeaker(value: unknown): Speaker | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id || typeof v.x !== "number" || typeof v.y !== "number" || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  const position = clampToGarden({ x: v.x, y: v.y });
  return { id: v.id.slice(0, 64), name: cleanName(v.name), ...position, sound: normalizeSound(v.sound) };
}

export function normalizeSpeakers(value: unknown): Speaker[] {
  const seen = new Set<string>();
  const result: Speaker[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const speaker = normalizeSpeaker(item);
    if (speaker && !seen.has(speaker.id) && result.length < MAX_SPEAKERS) {
      seen.add(speaker.id);
      result.push(speaker);
    }
  }
  return result;
}

/** Reads device storage; anything missing or broken falls back to the initial garden. */
export function normalizeMyGarden(value: unknown): MyGarden {
  if (!value || typeof value !== "object") return initialGarden();
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.speakers)) return initialGarden();
  const presets = (Array.isArray(v.presets) ? v.presets : []).flatMap((item): Preset[] => {
    const p = item as Record<string, unknown> | null;
    if (!p || typeof p.id !== "string" || !p.id) return [];
    return [{ id: p.id, name: cleanName(p.name), speakers: normalizeSpeakers(p.speakers) }];
  });
  return { speakers: normalizeSpeakers(v.speakers), presets: presets.slice(0, MAX_PRESETS) };
}

export const MAX_PRESETS = 20;
export const NAME_MAX_LENGTH = 24;

export function cleanName(name: unknown): string {
  const text = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_LENGTH) : "";
  return text || "Speaker";
}

/** Places a new speaker with the default sound. Returns the same list when the garden is full. */
export function addSpeaker(speakers: readonly Speaker[], at: Point, id: string): Speaker[] {
  if (speakers.length >= MAX_SPEAKERS) return [...speakers];
  return [...speakers, { id, name: "Speaker " + (speakers.length + 1), ...clampToGarden(at), sound: defaultSound() }];
}

export function moveSpeaker(speakers: readonly Speaker[], id: string, to: Point): Speaker[] {
  return speakers.map((speaker) => (speaker.id === id ? { ...speaker, ...clampToGarden(to) } : speaker));
}

export function updateSpeaker(speakers: readonly Speaker[], id: string, patch: { name?: string; sound?: SpeakerSound }): Speaker[] {
  return speakers.map((speaker) =>
    speaker.id === id
      ? { ...speaker, name: patch.name === undefined ? speaker.name : cleanName(patch.name), sound: patch.sound ? normalizeSound(patch.sound) : speaker.sound }
      : speaker,
  );
}

export function removeSpeaker(speakers: readonly Speaker[], id: string): Speaker[] {
  return speakers.filter((speaker) => speaker.id !== id);
}

/** Every preset the user can pick: built-in ones first, then their own. */
export function allPresets(garden: MyGarden): Preset[] {
  return [...BUILT_IN_PRESETS, ...garden.presets];
}

/** Saves the current layout as a user preset. A preset with the same name is replaced. */
export function savePreset(garden: MyGarden, name: string, id: string): MyGarden {
  const cleaned = cleanName(name);
  const others = garden.presets.filter((preset) => preset.name !== cleaned);
  if (others.length >= MAX_PRESETS) return garden;
  return { ...garden, presets: [...others, { id, name: cleaned, speakers: copy(garden.speakers) }] };
}

export function deletePreset(garden: MyGarden, id: string): MyGarden {
  return { ...garden, presets: garden.presets.filter((preset) => preset.id !== id) };
}

/** Replaces the layout with a preset's. An unknown id leaves the garden unchanged. */
export function applyPreset(garden: MyGarden, id: string): MyGarden {
  const preset = allPresets(garden).find((item) => item.id === id);
  return preset ? { ...garden, speakers: copy(preset.speakers) } : garden;
}

/** Back to the first-run state: the first built-in layout and no user presets. */
export function resetGarden(): MyGarden {
  return initialGarden();
}
