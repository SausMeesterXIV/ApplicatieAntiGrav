import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabase';
import { groepWerkjaar, kiesGroep } from '../../lib/oudleiding';
import { showToast } from '../../components/Toast';

// Leiding zit in precies één groep. Bij de eerste keer en aan het begin van elk werkjaar (1 september)
// kies je ze opnieuw; daarna kan enkel de hoofdleiding ze nog aanpassen (Rollen).
export const GroepKiezenScreen = () => {
  const { currentUser, groepen, refreshRoles } = useAuth();
  const [gekozen, setGekozen] = useState(currentUser?.groepIds?.[0] ?? null);
  const [bezig, setBezig] = useState(false);
  const eerste = !currentUser?.groep_werkjaar;

  const bevestig = async () => {
    if (!gekozen) return;
    setBezig(true);
    try {
      await kiesGroep(gekozen);
      await refreshRoles();
    } catch (e) {
      showToast('Opslaan mislukt: ' + (e.message || 'onbekende fout'), 'error');
      setBezig(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white flex flex-col">
      <main className="flex-1 w-full max-w-md mx-auto px-6 pt-[calc(3rem+env(safe-area-inset-top,0px))] pb-8 flex flex-col">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Werkjaar {groepWerkjaar()}</p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-1">Wat is je groep?</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {eerste
            ? 'Kies de groep waarvan je leiding bent.'
            : 'Een nieuw werkjaar: kies de groep waarvan je dit jaar leiding bent.'}{' '}
          Daarna kan enkel de hoofdleiding ze nog aanpassen.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Leidingsgroep">
          {groepen.map(g => {
            const actief = gekozen === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={actief}
                onClick={() => setGekozen(g.id)}
                className={`rounded-2xl px-4 py-4 text-left font-bold text-lg border-2 transition-colors ${
                  actief
                    ? 'bg-inkt text-white border-inkt dark:bg-white dark:text-inkt dark:border-white'
                    : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700'
                }`}
              >
                {g.naam}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
        <button
          type="button"
          onClick={bevestig}
          disabled={!gekozen || bezig}
          className="mt-8 w-full py-4 rounded-2xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold text-lg disabled:opacity-40"
        >
          {bezig ? 'Opslaan…' : 'Bevestigen'}
        </button>
        <button
          type="button"
          onClick={() => supabase.auth.signOut({ scope: 'local' })}
          className="mt-3 text-sm font-semibold text-gray-500 dark:text-gray-400"
        >
          Uitloggen
        </button>
      </main>
    </div>
  );
};
