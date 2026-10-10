import React, { useCallback, useEffect, useState } from 'react';
import { showToast } from '../../components/Toast';
import * as fin from '../../lib/financien';

const tijd = t =>
  t ? new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nog nooit';

// Koppeling met de Google Sheet: aanmaken, openen, nu synchroniseren, status en aandachtspunten.
export const SheetKoppeling = ({ onGesynchroniseerd }) => {
  const [koppeling, setKoppeling] = useState(null);
  const [bezig, setBezig] = useState(null); // 'aanmaken' | 'sync'

  const laad = useCallback(() => {
    fin
      .fetchSheetKoppeling()
      .then(setKoppeling)
      .catch(() => setKoppeling(null));
  }, []);

  useEffect(() => {
    laad();
    const t = setInterval(laad, 15000); // status bijhouden zolang het scherm open is
    return () => clearInterval(t);
  }, [laad]);

  const doe = async actie => {
    if (
      actie === 'aanmaken' &&
      koppeling?.spreadsheet_id &&
      !window.confirm('Er is al een rekenblad gekoppeld. Een nieuw maken en dat koppelen? Het oude blijft in Drive staan, maar wordt niet meer bijgewerkt.')
    ) {
      return;
    }
    setBezig(actie);
    try {
      const res = await fin.sheetActie(actie);
      if (res?.bezig) showToast('Er loopt al een synchronisatie; even geduld', 'info');
      else if (res?.sync?.fout) showToast(res.sync.fout, 'warning');
      else showToast(actie === 'aanmaken' ? 'Rekenblad aangemaakt en gevuld' : 'Gesynchroniseerd', 'success');
      await onGesynchroniseerd?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(null);
      laad();
    }
  };

  // Noodplan: koppeling UIT/AAN (staat ook in de Sheet zelf, tabblad Uitleg)
  const wisselKoppeling = async aan => {
    const vraag = aan
      ? 'Koppeling terug AANzetten?\n\nDe app maakt eerst een reservekopie van het rekenblad en neemt daarna over: Betaald, Betaald op, Opmerking, Bedrag (andere betalingen) en nieuwe rijen. Verwijderde rijen en de tabbladen Overzicht en Strepen worden teruggezet zoals in de app.'
      : 'Koppeling UITzetten (noodplan)?\n\nDe app raakt het rekenblad dan niet meer aan: je werkt erin zoals vroeger. In de app blijft alles bewaard; terug aanzetten kan altijd.';
    if (!window.confirm(vraag)) return;
    setBezig('koppeling');
    try {
      const res = await fin.sheetActie('koppeling', { aan });
      if (res?.bezig) showToast('Er loopt al een synchronisatie; probeer het zo opnieuw', 'info');
      else showToast(aan ? 'Koppeling staat weer aan' : 'Koppeling staat uit: werk verder in de Sheet', 'success');
      await onGesynchroniseerd?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(null);
      laad();
    }
  };

  const gekoppeld = !!koppeling?.spreadsheet_id;
  const gepauzeerd = gekoppeld && !!koppeling?.gepauzeerd;
  const problemen = Array.isArray(koppeling?.problemen) ? koppeling.problemen : [];

  return (
    <section className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
      <div className="flex items-start gap-3">
        <span className="material-icons-round text-green-600 mt-0.5">table_view</span>
        <div className="flex-1">
          <h2 className="font-bold">Google Sheet</h2>
          <p className="text-xs text-gray-500">
            {gekoppeld
              ? 'Gekoppeld in twee richtingen: wijzigingen in de app staan meteen in het rekenblad, wijzigingen in het rekenblad binnen ongeveer 30 seconden hier.'
              : 'Nog geen rekenblad. Maak er een: het komt in de Drive van KSA en wordt meteen gevuld met alle drankfacturen en betalingen.'}
          </p>
        </div>
      </div>

      {gepauzeerd && (
        <div className="text-xs p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 space-y-1">
          <p className="font-bold">Koppeling staat UIT (noodplan)</p>
          <p>
            Het rekenblad wordt niet meer bijgewerkt en wijzigingen erin komen niet in de app. Werk in de Sheet zoals
            vroeger. Terug aanzetten kan hieronder of in de Sheet (tabblad Uitleg).
          </p>
        </div>
      )}

      {gekoppeld && !gepauzeerd && (
        <p className="text-xs text-gray-500">
          Laatst gesynchroniseerd: <span className="font-semibold">{tijd(koppeling.laatste_sync)}</span>
        </p>
      )}

      {gekoppeld && (
        <p className="text-xs text-gray-500">
          Reservekopie: elke dag een losse kopie in Drive, 14 dagen bewaard
          {koppeling.laatste_kopie_op && ` (laatste: ${new Date(`${koppeling.laatste_kopie_op}T12:00:00`).toLocaleDateString('nl-BE')})`}.{' '}
          {koppeling.map_url && (
            <a href={koppeling.map_url} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold">
              Map openen
            </a>
          )}
        </p>
      )}

      {koppeling?.laatste_fout && (
        <p className="text-xs p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
          Laatste poging mislukt ({tijd(koppeling.laatste_fout_op)}): {koppeling.laatste_fout}
        </p>
      )}

      {problemen.length > 0 && (
        <div className="text-xs p-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 space-y-1">
          <p className="font-bold">Rijen in het rekenblad die nog niet verwerkt zijn:</p>
          {problemen.map(p => (
            <p key={p}>• {p}</p>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {gekoppeld && (
          <a
            href={koppeling.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-1"
          >
            <span className="material-icons-round text-base">open_in_new</span> Openen
          </a>
        )}
        {gekoppeld && !gepauzeerd && (
          <button
            onClick={() => doe('sync')}
            disabled={!!bezig}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <span className={`material-icons-round text-base ${bezig === 'sync' ? 'animate-spin' : ''}`}>sync</span>
            {bezig === 'sync' ? 'Bezig…' : 'Nu synchroniseren'}
          </button>
        )}
      </div>
      {gekoppeld && (
        <button
          onClick={() => wisselKoppeling(gepauzeerd)}
          disabled={!!bezig}
          className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50 ${
            gepauzeerd
              ? 'bg-green-600 text-white'
              : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
          }`}
        >
          <span className="material-icons-round text-base">{gepauzeerd ? 'link' : 'link_off'}</span>
          {bezig === 'koppeling' ? 'Bezig…' : gepauzeerd ? 'Koppeling terug aanzetten' : 'Koppeling uitzetten (noodplan)'}
        </button>
      )}
      <button
        onClick={() => doe('aanmaken')}
        disabled={!!bezig}
        className={`w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${
          gekoppeld ? 'text-gray-500' : 'bg-inkt text-white dark:bg-white dark:text-inkt'
        }`}
      >
        {bezig === 'aanmaken' ? 'Rekenblad maken…' : gekoppeld ? 'Nieuw rekenblad maken' : 'Rekenblad aanmaken'}
      </button>
    </section>
  );
};
