import React, { useCallback, useEffect, useState } from 'react';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { useAuth } from './AuthContext';

// Voor de leider die gekozen werd bij "Wachtwoord vergeten": bij het openen van de app (en terwijl ze openstaat)
// een pop-up die niet weg kan: code maken of weigeren. De code staat enkel hier op het scherm.
export const ResetVerzoekPopup = () => {
  const { currentUser } = useAuth();
  const [verzoeken, setVerzoeken] = useState([]);
  const [code, setCode] = useState(null); // { naam, code } na "Maak code"
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    try {
      setVerzoeken(await db.fetchMijnResetverzoeken());
    } catch {
      setVerzoeken([]); // migratie nog niet gedraaid of geen verbinding
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

  const verzoek = verzoeken[0];
  if (!code && !verzoek) return null;

  const maakCode = async () => {
    setBezig(true);
    try {
      setCode({ naam: verzoek.naam, code: await db.maakResetcode(verzoek.id) });
    } catch (e) {
      showToast(e.message || 'Code maken lukte niet', 'error');
    } finally {
      setBezig(false);
      laad();
    }
  };

  const weiger = async () => {
    if (!window.confirm(`De vraag van ${verzoek.naam} weigeren?`)) return;
    setBezig(true);
    try {
      await db.weigerReset(verzoek.id);
    } catch {
      showToast('Weigeren lukte niet', 'error');
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
      aria-labelledby="reset-titel"
    >
      <div className="w-full max-w-sm rounded-[28px] bg-white dark:bg-[#1e2330] text-inkt dark:text-white p-6 space-y-5 shadow-2xl">
        {code ? (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Wachtwoord vergeten</p>
              <h2 id="reset-titel" className="text-2xl font-extrabold tracking-tight">
                Geef deze code aan {code.naam}
              </h2>
            </div>
            <p className="rounded-2xl bg-kaart-strepen dark:bg-kaart-strepen-d py-5 text-center text-5xl font-extrabold tracking-[0.2em] tabular-nums select-all">
              {code.code}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Zeg ze persoonlijk of stuur ze in een bericht dat enkel {code.naam} leest. De code is 10 minuten geldig en
              werkt maar één keer. Je ziet ze hierna niet meer terug.
            </p>
            <button
              type="button"
              onClick={() => setCode(null)}
              className="w-full rounded-2xl py-4 font-bold bg-inkt text-white dark:bg-white dark:text-inkt active:scale-[0.99]"
            >
              Klaar
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Wachtwoord vergeten</p>
              <h2 id="reset-titel" className="text-2xl font-extrabold tracking-tight">
                {verzoek.naam} vraagt jou een code
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              {verzoek.naam} ({verzoek.email}) is zijn of haar wachtwoord vergeten en koos jou om een code te geven.
              Maak enkel een code als je zeker weet dat {verzoek.naam} dit zelf vraagt, bv. omdat je het samen bekijkt
              of het net gevraagd werd.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={bezig}
                onClick={weiger}
                className="rounded-2xl py-4 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 active:scale-[0.99] disabled:opacity-50"
              >
                Weigeren
              </button>
              <button
                type="button"
                disabled={bezig}
                onClick={maakCode}
                className="rounded-2xl py-4 font-bold bg-inkt text-white dark:bg-white dark:text-inkt active:scale-[0.99] disabled:opacity-50"
              >
                Maak code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
