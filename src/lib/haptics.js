import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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

/** Trigger a lichte tik (voor knopdrukken) */
export const hapticFeedback = async () => {
  if (!isHapticEnabled()) return;
  await Haptics.impact({ style: ImpactStyle.Medium });
};

/** Trigger een succes-vibratie (voor bevestiging van streep) */
export const hapticSuccess = async () => {
  if (!isHapticEnabled()) return;
  await Haptics.notification({ type: NotificationType.Success });
};
