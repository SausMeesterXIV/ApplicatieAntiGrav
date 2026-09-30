import React, { useRef, useState } from 'react';
import { leesBestand, parseCsv, zoekBetalingen } from '../../lib/uittreksel';
import { showToast } from '../../components/Toast';

const euro = n =>
  `€${Number(n || 0)
    .toFixed(2)
    .replace('.', ',')}`;

// Drankteam: CSV-export van de KSA-rekening inlezen en betaalde facturen aanduiden.
// Het bestand blijft in de browser; enkel de status van de gekozen facturen gaat naar de database.
export const UittrekselInlezen = ({ facturen, onBetaald }) => {
  const invoer = useRef(null);
  const [resultaat, setResultaat] = useState(null); // null = nog niets ingelezen
  const [gekozen, setGekozen] = useState([]);
  const [bezig, setBezig] = useState(false);

  const openFacturen = facturen.filter(f => f.status !== 'betaald');

  const lees = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rijen = parseCsv(await leesBestand(file));
      const gevonden = zoekBetalingen(rijen, openFacturen).sort((a, b) =>
        (a.factuur.user_naam || '').localeCompare(b.factuur.user_naam || ''),
      );
      setResultaat(gevonden);
      setGekozen(gevonden.filter(g => g.bedragKlopt).map(g => g.factuur.id));
    } catch (err) {
      console.error(err);
      showToast('Kon het bestand niet lezen. Is het een CSV-export van de bank?', 'error');
    }
  };

  const wissel = id => setGekozen(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const bevestig = async () => {
    setBezig(true);
    try {
      await onBetaald(gekozen);
      showToast(`${gekozen.length} ${gekozen.length === 1 ? 'factuur' : 'facturen'} op betaald gezet`, 'success');
      setResultaat(null);
      setGekozen([]);
    } catch {
      showToast('Niet alle facturen konden aangepast worden', 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <section className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
      <div>
        <h2 className="font-bold">Betalingen uit bankuittreksel</h2>
        <p className="text-xs text-gray-500">
          Exporteer de verrichtingen van de KSA-rekening als CSV (bank-app of internetbankieren) en kies het bestand. De
          app zoekt de gestructureerde mededelingen van alle open facturen. Het bestand wordt niet opgeslagen.
        </p>
      </div>

      <input ref={invoer} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={lees} />
      <button
        onClick={() => invoer.current?.click()}
        className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2"
      >
        <span className="material-icons-round">upload_file</span> CSV-bestand kiezen
      </button>

      {resultaat && resultaat.length === 0 && (
        <p className="text-sm text-center text-gray-500">Geen betalingen voor open facturen gevonden in dit bestand.</p>
      )}

      {resultaat && resultaat.length > 0 && (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {resultaat.map(({ factuur, bedragKlopt, bedragen }) => (
              <li key={factuur.id}>
                <label className="flex items-center gap-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gekozen.includes(factuur.id)}
                    onChange={() => wissel(factuur.id)}
                    className="w-5 h-5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{factuur.user_naam || factuur.profiles?.naam}</p>
                    <p className="text-xs text-gray-500 font-mono">{factuur.mededeling}</p>
                    {!bedragKlopt && (
                      <p className="text-xs text-orange-600">
                        Bedrag wijkt af: betaald {bedragen.length ? bedragen.map(euro).join(' / ') : 'onbekend'}
                      </p>
                    )}
                  </div>
                  <p className="font-bold">{euro(factuur.totaal_bedrag)}</p>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => setResultaat(null)}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold"
            >
              Annuleren
            </button>
            <button
              onClick={bevestig}
              disabled={bezig || gekozen.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
            >
              {bezig ? 'Bezig…' : `Zet ${gekozen.length} op betaald`}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
