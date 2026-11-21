/** Sprinting stamina rules: Shift/sprint drains stamina, exhausting briefly on zero, and recovers after a short pause. */

export const MAX_STAMINA = 100;
export const RUN_SPEED = 5.4;
export const STAMINA_DRAIN_PER_SEC = 30;
export const STAMINA_REGEN_PER_SEC = 22;
export const STAMINA_REGEN_DELAY_MS = 600;
export const EXHAUSTED_RECOVERY = 25;

export interface StaminaState {
  stamina: number;
  exhausted: boolean;
  sprinting: boolean;
  lastDrainAt: number;
}

export function initialStaminaState(): StaminaState {
  return { stamina: MAX_STAMINA, exhausted: false, sprinting: false, lastDrainAt: 0 };
}

/**
 * Advances stamina over `dtSeconds`.
 * Sprinting activates only while moving and not exhausted; hitting 0 triggers exhaustion until EXHAUSTED_RECOVERY.
 */
export function stepStamina(
  state: StaminaState,
  wantsSprint: boolean,
  moving: boolean,
  dtSeconds: number,
  nowMs: number,
): StaminaState {
  const dt = Math.max(0, Math.min(dtSeconds, 0.1));
  const canSprint = wantsSprint && moving && !state.exhausted && state.stamina > 0;
  if (canSprint) {
    const next = Math.max(0, state.stamina - STAMINA_DRAIN_PER_SEC * dt);
    const exhausted = next <= 0;
    return {
      stamina: next,
      exhausted,
      sprinting: !exhausted,
      lastDrainAt: nowMs,
    };
  }

  let stamina = state.stamina;
  let exhausted = state.exhausted;
  if (stamina < MAX_STAMINA && nowMs - state.lastDrainAt >= STAMINA_REGEN_DELAY_MS) {
    stamina = Math.min(MAX_STAMINA, stamina + STAMINA_REGEN_PER_SEC * dt);
    if (exhausted && stamina >= EXHAUSTED_RECOVERY) {
      exhausted = false;
    }
  }
  return {
    stamina,
    exhausted,
    sprinting: false,
    lastDrainAt: state.lastDrainAt,
  };
}
