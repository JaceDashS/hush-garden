/** Individual speaker sound presets (up to 5 per user/device). */
import { NAME_MAX_LENGTH } from "./garden";
import { normalizeSound, type SpeakerSound } from "./sound";

export const MAX_SPEAKER_PRESETS = 5;

export interface SpeakerPreset {
  id: string;
  name: string;
  sound: SpeakerSound;
}

export function cleanPresetName(value: unknown): string {
  // eslint-disable-next-line no-control-regex
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX_LENGTH) : "";
}

export function normalizeSpeakerPresets(value: unknown): SpeakerPreset[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: SpeakerPreset[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const id = typeof v.id === "string" ? v.id.trim().slice(0, 64) : "";
    const name = cleanPresetName(v.name);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    list.push({ id, name, sound: normalizeSound(v.sound) });
    if (list.length >= MAX_SPEAKER_PRESETS) break;
  }
  return list;
}

/**
 * Inserts or updates a personal speaker preset.
 * Replaces by matching `id` or exact `name`; returns the original list unchanged if at MAX_SPEAKER_PRESETS.
 */
export function upsertSpeakerPreset(
  presets: readonly SpeakerPreset[],
  input: { id: string; name: string; sound: SpeakerSound },
): SpeakerPreset[] {
  const name = cleanPresetName(input.name);
  if (!name) return [...presets];
  const sound = normalizeSound(input.sound);
  const existingIndex = presets.findIndex((item) => item.id === input.id || item.name === name);
  if (existingIndex >= 0) {
    return presets.map((item, idx) => (idx === existingIndex ? { ...item, name, sound } : item));
  }
  if (presets.length >= MAX_SPEAKER_PRESETS) return [...presets];
  return [...presets, { id: input.id, name, sound }];
}

export function removeSpeakerPreset(presets: readonly SpeakerPreset[], id: string): SpeakerPreset[] {
  return presets.filter((item) => item.id !== id);
}
