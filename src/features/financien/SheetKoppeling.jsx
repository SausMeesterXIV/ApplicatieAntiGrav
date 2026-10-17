import React, { useCallback, useEffect, useState } from 'react';
import { showToast } from '../../components/Toast';
import * as fin from '../../lib/financien';

const tijd = t =>
  t ? new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nog nooit';

// Koppeling met de Financiën-Sheet: koppelen (link van een rekenblad dat gedeeld is met de robot), openen,
// nu synchroniseren, status en aandachtspunten.
export const SheetKoppeling = ({ onGesynchroniseerd }) => {
  const [koppeling, setKoppeling] = useState(null);
  const [bezig, setBezig] = useState(null); // 'koppelen' | 'sync' | 'koppeling'
  const [toonKoppelen, setToonKoppelen] = useState(false);
  const [link, setLink] = useState('');
  const [robot, setRobot] = useState(null); // e-mailadres van de robot

  useEffect(() => {
    if (toonKoppelen && !robot) fin.sheetActie('robot').then(d => setRobot(d?.email || null)).catch(() => {});
  }, [toonKoppelen, robot]);

  const kopieerRobot = async () => {
    try {
      await navigator.clipboard.writeText(robot);
      showToast('E-mailadres gekopieerd', 'success');
    } catch {
      showToast('Kopiëren lukt niet op dit toestel', 'warning');
    }
  };

  const koppel = async () => {
    if (!link.trim()) return;
    if (
      koppeling?.spreadsheet_id &&
      !window.confirm('Er is al een rekenblad gekoppeld. Dit nieuwe koppelen? Het oude blijft bestaan, maar wordt niet meer bijgewerkt.')
    ) {
      return;
    }
    setBezig('koppelen');
    try {
      const res = await fin.sheetActie('koppelen', { link: link.trim() });
      if (res?.sync?.fout) showToast(res.sync.fout, 'warning');
      else showToast('Rekenblad gekoppeld en gevuld', 'success');
      setToonKoppelen(false);
      setLink('');
      await onGesynchroniseerd?.();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(null);
      laad();
    }
  };

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
    setBezig(actie);
    try {
      const res = await fin.sheetActie(actie);
      if (res?.bezig) showToast('Er loopt al een synchronisatie; even geduld', 'info');
      else if (res?.sync?.fout) showToast(res.sync.fout, 'warning');
      else showToast('Gesynchroniseerd', 'success');
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
      ? 'Koppeling terug AANzetten?\n\nDe app neemt over: Betaald, Betaald op, Opmerking, Bedrag (andere betalingen) en nieuwe rijen. Verwijderde rijen en de tabbladen Overzicht en Strepen worden teruggezet zoals in de app.'
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
          <h2 className="font-bold">Financiën-Sheet</h2>
          <p className="text-xs text-gray-500">
            {gekoppeld
              ? 'Gekoppeld in twee richtingen: wijzigingen in de app staan meteen in het rekenblad, wijzigingen in het rekenblad binnen ongeveer 30 seconden hier.'
              : 'Nog geen rekenblad. Koppel er een: het wordt meteen gevuld met alle drankfacturen en betalingen, per leider wat openstaat en de strepen.'}
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
          Iets misgelopen? In het rekenblad toont Bestand → Versiegeschiedenis elke vorige versie.
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
      {toonKoppelen ? (
        <div className="space-y-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
          <ol className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal pl-4">
            <li>Maak in Google Drive een nieuw, leeg rekenblad (Google Spreadsheets), bv. "KSA Aalter – Financiën leiding".</li>
            <li>
              Klik op Delen en geef dit adres de rol <b>Bewerker</b> (melding sturen mag uit):
              <span className="mt-1 flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg bg-white dark:bg-gray-900 px-2 py-1.5 text-[11px]">{robot || 'laden…'}</code>
                {robot && (
                  <button type="button" onClick={kopieerRobot} className="shrink-0 rounded-lg bg-inkt text-white dark:bg-white dark:text-inkt px-2.5 py-1.5 text-xs font-bold">
                    Kopieer
                  </button>
                )}
              </span>
            </li>
            <li>Deel het ook met Financiën en hoofdleiding, en plak hieronder de link uit de adresbalk.</li>
          </ol>
          <input
            type="url"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setToonKoppelen(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold">
              Annuleren
            </button>
            <button
              type="button"
              onClick={koppel}
              disabled={!!bezig || !link.trim()}
              className="flex-1 py-2.5 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt text-sm font-bold disabled:opacity-50"
            >
              {bezig === 'koppelen' ? 'Koppelen…' : 'Koppelen'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setToonKoppelen(true)}
          disabled={!!bezig}
          className={`w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${
            gekoppeld ? 'text-gray-500' : 'bg-inkt text-white dark:bg-white dark:text-inkt'
          }`}
        >
          {gekoppeld ? 'Ander rekenblad koppelen' : 'Rekenblad koppelen'}
        </button>
      )}
    </section>
  );
};
