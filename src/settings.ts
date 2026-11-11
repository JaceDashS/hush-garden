/** User settings kept on the device. */
import { DEFAULT_CHARACTER, normalizeCharacter, type CharacterKind } from "./domain/characters";
import type { CueMode } from "./domain/chat";
import { checkName } from "./domain/names";

/** A stored name that no longer passes the name rule is dropped. */
function nameOrEmpty(value: unknown): string {
  const check = checkName(value);
  return check.ok ? check.name : "";
}

export interface Settings {
  /** Master volume, 0 to 1. */
  volume: number;
  /** How a nearby chat is hinted. */
  cue: CueMode;
  /** The user agreed to location use for the public garden. */
  consent: boolean;
  /** The character the player chose. */
  character: CharacterKind;
  /** The character name the player typed. Empty means the account name, or "Guest". */
  name: string;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.8, cue: "tone", consent: false, character: DEFAULT_CHARACTER, name: "" };

/** Turns stored JSON into valid settings; unknown or broken values fall back to defaults. */
export function normalizeSettings(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    volume: typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : DEFAULT_SETTINGS.volume,
    cue: v.cue === "dip" || v.cue === "off" || v.cue === "tone" ? v.cue : DEFAULT_SETTINGS.cue,
    consent: v.consent === true,
    character: normalizeCharacter(v.character),
    name: nameOrEmpty(v.name),
  };
}
