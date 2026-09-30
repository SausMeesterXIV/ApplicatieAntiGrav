// Web Push (VAPID) in de browser: abonneren, afmelden en status.
// De publieke VAPID-sleutel komt uit .env (VITE_VAPID_PUBLIC_KEY); de private sleutel staat enkel
// als secret bij de edge function send-push.
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isPushOndersteund = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isPushIngesteld = () => !!VAPID_PUBLIC_KEY;

function urlBase64NaarUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function registratie() {
  // De service worker wordt door vite-plugin-pwa geregistreerd (enkel in de gebouwde app / preview)
  return navigator.serviceWorker.ready;
}

async function bewaarAbonnement(userId, abonnement) {
  const { endpoint, keys } = abonnement.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

/** Zet push aan op dit toestel: vraagt toestemming, abonneert en bewaart het abonnement. */
export async function zetPushAan(userId) {
  if (!isPushOndersteund()) throw new Error('Pushmeldingen worden niet ondersteund in deze browser');
  if (!isPushIngesteld()) throw new Error('Pushmeldingen zijn nog niet ingesteld (VAPID-sleutel ontbreekt)');

  const toestemming = await Notification.requestPermission();
  if (toestemming !== 'granted') throw new Error('Je gaf geen toestemming voor meldingen');

  const reg = await registratie();
  const abonnement =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64NaarUint8Array(VAPID_PUBLIC_KEY) }));
  await bewaarAbonnement(userId, abonnement);

  const { error } = await supabase.from('profiles').update({ push_enabled: true }).eq('id', userId);
  if (error) throw error;
}

/** Zet push uit: voor alle toestellen (profiel) en meldt dit toestel af. */
export async function zetPushUit(userId) {
  const { error } = await supabase.from('profiles').update({ push_enabled: false }).eq('id', userId);
  if (error) throw error;
  if (!isPushOndersteund()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const abonnement = await reg?.pushManager.getSubscription();
  if (abonnement) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', abonnement.endpoint);
    await abonnement.unsubscribe();
  }
}

/** Bij het opstarten: bestaand abonnement opnieuw bewaren (endpoints kunnen wijzigen). Vraagt nooit toestemming. */
export async function vernieuwAbonnement(userId) {
  if (!isPushOndersteund() || !isPushIngesteld() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const abonnement = await reg?.pushManager.getSubscription();
  if (abonnement) await bewaarAbonnement(userId, abonnement);
}

/** Staat push aan op dit toestel? */
export async function pushActiefOpToestel() {
  if (!isPushOndersteund() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}
