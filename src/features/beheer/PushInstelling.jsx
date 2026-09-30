import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { showToast } from '../../components/Toast';
import {
  isIOS,
  isStandalone,
  isPushOndersteund,
  isPushIngesteld,
  pushActiefOpToestel,
  zetPushAan,
  zetPushUit,
} from '../../lib/push';

// Instellingen > Pushmeldingen aan/uit voor dit toestel
export const PushInstelling = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const [aan, setAan] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    pushActiefOpToestel()
      .then(actief => setAan(actief && currentUser?.push_enabled !== false))
      .catch(() => {});
  }, [currentUser?.push_enabled]);

  const iosZonderBeginscherm = isIOS() && !isStandalone();

  const wissel = async () => {
    if (!currentUser) return;
    setBezig(true);
    try {
      if (aan) {
        await zetPushUit(currentUser.id);
        setCurrentUser({ ...currentUser, push_enabled: false });
        setAan(false);
        showToast('Pushmeldingen uitgezet', 'info');
      } else {
        await zetPushAan(currentUser.id);
        setCurrentUser({ ...currentUser, push_enabled: true });
        setAan(true);
        showToast('Pushmeldingen aangezet', 'success');
      }
    } catch (e) {
      showToast(e.message || 'Instellen mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  let uitleg = 'Krijg een melding op je gsm bij nieuwe berichten, agenda-items en polls.';
  if (iosZonderBeginscherm) {
    uitleg = 'Op iPhone werken meldingen enkel als de app op je beginscherm staat: tik op Delen en kies "Zet op beginscherm". Open de app daarna vanaf je beginscherm.';
  } else if (!isPushOndersteund()) {
    uitleg = 'Deze browser ondersteunt geen pushmeldingen.';
  } else if (!isPushIngesteld()) {
    uitleg = 'Pushmeldingen zijn nog niet ingesteld door de beheerder.';
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    uitleg = 'Je hebt meldingen geblokkeerd. Zet ze terug aan in de instellingen van je browser of gsm.';
  }

  const kan =
    !iosZonderBeginscherm &&
    isPushOndersteund() &&
    isPushIngesteld() &&
    !(typeof Notification !== 'undefined' && Notification.permission === 'denied');

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-100 dark:border-gray-800/50">
      <div className="flex items-start gap-3">
        <span className="material-icons-round text-blue-600 dark:text-blue-500">notifications_active</span>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">Pushmeldingen</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{uitleg}</p>
        </div>
      </div>
      <button
        onClick={wissel}
        disabled={!kan || bezig}
        aria-pressed={aan}
        className={`relative w-12 h-6 shrink-0 rounded-full transition-colors disabled:opacity-40 ${aan ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform ${aan ? 'translate-x-6' : ''}`}
        />
      </button>
    </div>
  );
};
