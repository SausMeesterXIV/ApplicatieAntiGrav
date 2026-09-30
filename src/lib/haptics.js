// Trillen via de standaard Vibration API van de browser.
// Werkt op Android (Chrome); iPhone-browsers ondersteunen dit niet en doen dan gewoon niets.

const HAPTIC_KEY = 'haptic_enabled';

/** Check if haptics are enabled (default: true) */
export const isHapticEnabled = () => {
  const stored = localStorage.getItem(HAPTIC_KEY);
  return stored === null ? true : stored === 'true';
};

/** Toggle haptic preference */
export const setHapticEnabled = enabled => {
  localStorage.setItem(HAPTIC_KEY, String(enabled));
};

const tril = patroon => {
  if (!isHapticEnabled() || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(patroon);
  } catch {
    // sommige browsers weigeren trillen zonder gebruikersactie
  }
};

/** Trigger a lichte tik (voor knopdrukken) */
export const hapticFeedback = async () => tril(20);

/** Trigger een succes-vibratie (voor bevestiging van streep) */
export const hapticSuccess = async () => tril([30, 50, 30]);
