/**
 * Haptic feedback utility.
 * Uses navigator.vibrate() for a short tactile burst.
 * Respects the user's preference stored in localStorage.
 */

const HAPTIC_KEY = 'haptic_enabled';

/** Check if haptics are enabled (default: true) */
export const isHapticEnabled = (): boolean => {
  const stored = localStorage.getItem(HAPTIC_KEY);
  return stored === null ? true : stored === 'true';
};

/** Toggle haptic preference */
export const setHapticEnabled = (enabled: boolean): void => {
  localStorage.setItem(HAPTIC_KEY, String(enabled));
};

/** Trigger a short haptic vibration (15ms) */
export const hapticFeedback = (): void => {
  if (!isHapticEnabled()) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(15);
  }
};

/** Trigger a success haptic pattern (two short bursts) */
export const hapticSuccess = (): void => {
  if (!isHapticEnabled()) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([10, 50, 15]);
  }
};
