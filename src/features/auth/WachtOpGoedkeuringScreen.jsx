import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';

// Nieuw account: wacht tot iemand van de leiding het goedkeurt (of toont dat het afgewezen is).
// Kijkt elke 15 seconden opnieuw, zodat je vanzelf binnen bent zodra iemand je accepteert.
export const WachtOpGoedkeuringScreen = () => {
  const { goedkeuring, controleerGoedkeuring, session } = useAuth();
  const [bezig, setBezig] = useState(false);
  const afgewezen = goedkeuring === 'afgewezen';

  useEffect(() => {
    if (afgewezen) return;
    const t = setInterval(() => controleerGoedkeuring(), 15000);
    return () => clearInterval(t);
  }, [afgewezen, controleerGoedkeuring]);

  const opnieuw = async () => {
    setBezig(true);
    await controleerGoedkeuring();
    setBezig(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div
          className={`mx-auto w-20 h-20 rounded-[28px] flex items-center justify-center ${
            afgewezen ? 'bg-red-50 dark:bg-red-900/20' : 'bg-kaart-strepen dark:bg-kaart-strepen-d'
          }`}
        >
          <span className={`material-icons-round text-4xl ${afgewezen ? 'text-red-600 dark:text-red-400' : ''}`}>
            {afgewezen ? 'block' : 'hourglass_top'}
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
            {afgewezen ? 'Account afgewezen' : 'Wacht op goedkeuring'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {afgewezen
              ? 'De leiding heeft je account niet goedgekeurd. Denk je dat dit een vergissing is? Spreek de hoofdleiding aan.'
              : 'Je account is aangemaakt. Iemand van de leiding moet het nog goedkeuren. Daarna kom je hier vanzelf binnen.'}
          </p>
          {session?.user?.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{session.user.email}</p>
          )}
        </div>

        <div className="space-y-2">
          {!afgewezen && (
            <button
              type="button"
              onClick={opnieuw}
              disabled={bezig}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold active:scale-[0.99] disabled:opacity-50"
            >
              {bezig ? 'Even kijken…' : 'Opnieuw controleren'}
            </button>
          )}
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full rounded-2xl bg-kaart-event dark:bg-kaart-event-d py-4 font-bold active:scale-[0.99]"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
};
