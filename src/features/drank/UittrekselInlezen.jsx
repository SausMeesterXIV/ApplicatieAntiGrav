import React, { useRef, useState } from 'react';
import { leesBestand, parseCsv, pdfRijen, zoekBetalingen } from '../../lib/uittreksel';
import { pdfRegels } from '../../lib/pdfTekst';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';

// Drankteam en Financiën: betalingen van leiders uit de bank inlezen (CSV uit KBC Touch of PDF's uit de KBC-app)
// en hun facturen in één keer op betaald zetten. De app zoekt enkel de mededelingen van open facturen.
// Het bestand blijft in de browser; enkel de status van de gekozen facturen gaat naar de database.
export const UittrekselInlezen = ({ facturen, onBetaald }) => {
  const invoer = useRef(null);
  const [resultaat, setResultaat] = useState(null); // null = nog niets ingelezen
  const [gekozen, setGekozen] = useState([]);
  const [bezig, setBezig] = useState(false);

  const openFacturen = facturen.filter(f => f.status !== 'betaald');

  const lees = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const rijen = [];
    const mislukt = [];
    for (const file of files) {
      try {
        const isPdf = /.pdf$/i.test(file.name) || file.type === 'application/pdf';
        const uit = isPdf ? pdfRijen(await pdfRegels(file)) : parseCsv(await leesBestand(file));
        if (!uit.length) mislukt.push(file.name);
        rijen.push(...uit);
      } catch (err) {
        console.error(err);
        mislukt.push(file.name);
      }
    }
    const gevonden = zoekBetalingen(rijen, openFacturen).sort((a, b) =>
      (a.factuur.user_naam || '').localeCompare(b.factuur.user_naam || ''),
    );
    setResultaat(gevonden);
    setGekozen(gevonden.filter(g => g.bedragKlopt).map(g => g.factuur.id));
    if (mislukt.length) {
      showToast(`Niet te lezen: ${mislukt.join(', ')}. Is het een CSV of PDF van KBC?`, 'error');
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
          De app zoekt de mededelingen van alle open facturen en zet die leiders in één keer op betaald. Andere
          verrichtingen negeert ze. Het bestand wordt niet opgeslagen.
        </p>
      </div>

      <ul className="text-xs text-gray-500 space-y-1">
        <li>
          <span className="font-semibold text-gray-700 dark:text-gray-300">CSV:</span> op de website KBC Touch (computer), bij de
          KSA-rekening de verrichtingen exporteren als CSV. Eén bestand voor de hele periode.
        </li>
        <li>
          <span className="font-semibold text-gray-700 dark:text-gray-300">PDF:</span> in de KBC-app, tik op een betaling en bewaar
          ze als PDF. Je kan er meerdere tegelijk kiezen.
        </li>
      </ul>

      <input ref={invoer} type="file" multiple accept=".csv,.txt,text/csv,.pdf,application/pdf" className="hidden" onChange={lees} />
      <button
        onClick={() => invoer.current?.click()}
        className="w-full py-2.5 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold flex items-center justify-center gap-2"
      >
        <span className="material-icons-round">account_balance</span> Uit de bank (CSV of PDF)
      </button>

      {resultaat && resultaat.length === 0 && (
        <p className="text-sm text-center text-gray-500">Geen betalingen voor open facturen gevonden. Wie zonder de juiste mededeling betaalde, zet je zelf op betaald.</p>
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
