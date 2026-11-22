/** User settings kept on the device. */
import { DEFAULT_CHARACTER, isCharacterKind, normalizeCharacter, randomCharacter, type CharacterKind } from "./domain/characters";
import type { CueMode } from "./domain/chat";
import { isCharacterId } from "./domain/imageCharacters";
import { checkName } from "./domain/names";
import { normalizeSpeakerPresets, type SpeakerPreset } from "./domain/speakerPresets";
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
  /** Mixes all master audio down to mono when true; stereo when false. */
  mono: boolean;
  /** How a nearby chat is hinted. */
  cue: CueMode;
  /** Whether background OS notifications are enabled for nearby chat. */
  chatNotifications: boolean;
  /** The user agreed to location use for the public garden. */
  consent: boolean;
  /** The character the player chose. */
  character: CharacterKind;
  /** Custom character image id, or empty. */
  customCharacter: string;
  /** Chat ripple colour (#rrggbb), or "" to match the chosen character's colour. */
  chatColor: string;
  /** The character name the player typed. Empty means the account name, or "Guest". */
  name: string;
  /** The language of the screens. */
  language: Language;
  /**
   * Whether to download the nature sounds: "ask" asks on entering while files are missing, "yes" downloads without
   * asking (the player agreed once), "no" never asks (the player ticked "don't ask again"; settings still offer it).
   */
  natureSounds: "ask" | "yes" | "no";
  /** Personal speaker sound presets (up to 5). Synced with server account when signed in. */
  speakerPresets: SpeakerPreset[];
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.8,
  mono: false,
  cue: "tone",
  chatNotifications: true,
  consent: false,
  character: DEFAULT_CHARACTER,
  customCharacter: "",
  chatColor: "",
  name: "",
  language: "ko",
  natureSounds: "ask",
  speakerPresets: [],
};

/** Turns stored JSON into valid settings; unknown or broken values fall back to defaults. A missing language becomes the device language. */
export function normalizeSettings(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    volume: typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : DEFAULT_SETTINGS.volume,
    mono: v.mono === true,
    cue: v.cue === "dip" || v.cue === "off" || v.cue === "tone" ? v.cue : DEFAULT_SETTINGS.cue,
    chatNotifications: typeof v.chatNotifications === "boolean" ? v.chatNotifications : DEFAULT_SETTINGS.chatNotifications,
    consent: v.consent === true,
    character: normalizeCharacter(v.character),
    customCharacter: isCharacterId(v.customCharacter) ? v.customCharacter : "",
    chatColor: typeof v.chatColor === "string" && /^#[0-9a-fA-F]{6}$/.test(v.chatColor) ? v.chatColor.toLowerCase() : "",
    name: nameOrEmpty(v.name),
    language: normalizeLanguage(v.language, deviceLanguage()),
    natureSounds: v.natureSounds === "yes" || v.natureSounds === "no" ? v.natureSounds : "ask",
    speakerPresets: normalizeSpeakerPresets(v.speakerPresets),
  };
}

/**
 * Resolves settings loaded from storage: preserves an existing valid character choice, or assigns and flags
 * a newly picked random character for first-time visitors (or when the stored character is missing/invalid).
 */
export function resolveLoadedSettings(
  raw: unknown,
  random: () => number = Math.random,
): { settings: Settings; shouldSave: boolean } {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && isCharacterKind((raw as Record<string, unknown>).character)) {
    return { settings: normalizeSettings(raw), shouldSave: false };
  }
  const picked = randomCharacter(random);
  const settings = normalizeSettings({
    ...(raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}),
    character: picked,
  });
  return { settings, shouldSave: true };
}
