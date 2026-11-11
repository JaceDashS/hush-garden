/** User settings kept on the device. */
import type { CueMode } from "./domain/chat";

export interface Settings {
  /** Master volume, 0 to 1. */
  volume: number;
  /** How a nearby chat is hinted. */
  cue: CueMode;
  /** The user agreed to location use for the public garden. */
  consent: boolean;
}

export const DEFAULT_SETTINGS: Settings = { volume: 0.8, cue: "tone", consent: false };

/** Turns stored JSON into valid settings; unknown or broken values fall back to defaults. */
export function normalizeSettings(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    volume: typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.max(0, Math.min(1, v.volume)) : DEFAULT_SETTINGS.volume,
    cue: v.cue === "dip" || v.cue === "off" || v.cue === "tone" ? v.cue : DEFAULT_SETTINGS.cue,
    consent: v.consent === true,
  };
}
