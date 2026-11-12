/** User settings kept on the device. */
import { DEFAULT_CHARACTER, normalizeCharacter, type CharacterKind } from "./domain/characters";
import type { CueMode } from "./domain/chat";
import { checkName } from "./domain/names";
import { languageForLocale, normalizeLanguage, type Language } from "./domain/text";

/** A stored name that no longer passes the name rule is dropped. */
function nameOrEmpty(value: unknown): string {
  const check = checkName(value);
  return check.ok ? check.name : "";
}

/** The language the device is set to, used until the player picks one. */
export function deviceLanguage(): Language {
  try {
    const browser = (globalThis as { navigator?: { language?: string } }).navigator?.language;
    return languageForLocale(browser || Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "en";
  }
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
  /** The language of the screens. */
  language: Language;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.8, cue: "tone", consent: false, character: DEFAULT_CHARACTER, name: "", language: "ko" };

/** Turns stored JSON into valid settings; unknown or broken values fall back to defaults. A missing language becomes the device language. */
export function normalizeSettings(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    volume: typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : DEFAULT_SETTINGS.volume,
    cue: v.cue === "dip" || v.cue === "off" || v.cue === "tone" ? v.cue : DEFAULT_SETTINGS.cue,
    consent: v.consent === true,
    character: normalizeCharacter(v.character),
    name: nameOrEmpty(v.name),
    language: normalizeLanguage(v.language, deviceLanguage()),
  };
}
