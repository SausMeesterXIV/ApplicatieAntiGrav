import { useEffect } from 'react';
import { vernieuwAbonnement } from '../../lib/push';

// Houdt het push-abonnement van dit toestel up-to-date zodra iemand ingelogd is.
// Toestemming vragen gebeurt nooit automatisch, enkel via Instellingen > Pushmeldingen
// (iPhone vereist dat het na een tik van de gebruiker gebeurt).
export function usePushNotifications(currentUser) {
  useEffect(() => {
    if (!currentUser?.id || currentUser.push_enabled === false) return;
    vernieuwAbonnement(currentUser.id).catch(e => console.warn('Push-abonnement vernieuwen mislukt', e));
  }, [currentUser?.id, currentUser?.push_enabled]);
}
