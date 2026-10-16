import React, { useCallback, useEffect, useState } from 'react';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { useAuth } from './AuthContext';

// Voor alle actieve leiding: zolang er een nieuw account wacht, verschijnt deze pop-up over de hele app.
// Hij kan niet weg: je accepteert of wijst af. De eerste die beslist, beslist voor iedereen.
// De database bepaalt wie dit ziet (enkel actieve leiding, geen oudleiding).
export const GoedkeuringPopup = () => {
  const { currentUser } = useAuth();
  const [wachtend, setWachtend] = useState([]);
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    try {
      setWachtend(await db.fetchWachtendeAccounts());
    } catch {
      // Migratie nog niet gedraaid of geen verbinding: geen pop-up
      setWachtend([]);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.isOudleiding) return;
    laad();
    const t = setInterval(laad, 20000);
    const opFocus = () => document.visibilityState === 'visible' && laad();
    document.addEventListener('visibilitychange', opFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', opFocus);
    };
  }, [currentUser, laad]);

  const account = wachtend[0];
  if (!account) return null;

  const naam = [account.voornaam, account.achternaam].filter(Boolean).join(' ') || account.naam;

  const beslis = async goedkeuren => {
    if (!goedkeuren && !window.confirm(`${naam} afwijzen? Die persoon kan dan niet in de app.`)) return;
    setBezig(true);
    try {
      const status = await db.beoordeelAccount(account.id, goedkeuren);
      const gevraagd = goedkeuren ? 'goedgekeurd' : 'afgewezen';
      if (status === gevraagd) {
        showToast(goedkeuren ? `${naam} is goedgekeurd` : `${naam} is afgewezen`, 'success');
      } else {
        showToast(`Iemand anders was sneller: ${naam} is al ${status}`, 'info');
      }
    } catch (e) {
      showToast(e.message || 'Beslissen mislukt. Probeer opnieuw.', 'error');
    } finally {
      setBezig(false);
      laad();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goedkeuring-titel"
    >
      <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#1e2330] text-inkt dark:text-white p-6 space-y-5 shadow-2xl mb-[env(safe-area-inset-bottom,0px)]">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            Nieuw account{wachtend.length > 1 ? ` · 1 van ${wachtend.length}` : ''}
          </p>
          <h2 id="goedkeuring-titel" className="text-2xl font-extrabold tracking-tight">
            Is of wordt deze persoon leiding?
          </h2>
        </div>

        <dl className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d divide-y divide-white dark:divide-white/5">
          {[
            ['Voornaam', account.voornaam || '—'],
            ['Achternaam', account.achternaam || (account.voornaam ? '—' : account.naam)],
            ['E-mail', account.email],
          ].map(([label, waarde]) => (
            <div key={label} className="px-4 py-3 flex items-baseline justify-between gap-3">
              <dt className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
              <dd className="font-semibold text-right break-all">{waarde}</dd>
            </div>
          ))}
        </dl>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          Ken je deze persoon niet, of hoort die niet bij de leiding? Wijs dan af.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={bezig}
            onClick={() => beslis(false)}
            className="rounded-2xl py-4 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 active:scale-[0.99] disabled:opacity-50"
          >
            Afwijzen
          </button>
          <button
            type="button"
            disabled={bezig}
            onClick={() => beslis(true)}
            className="rounded-2xl py-4 font-bold bg-inkt text-white dark:bg-white dark:text-inkt active:scale-[0.99] disabled:opacity-50"
          >
            Accepteren
          </button>
        </div>
      </div>
    </div>
  );
};
