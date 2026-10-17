import React, { useEffect, useMemo, useState } from 'react';
import { fetchExterneFrietBestellingen, zetExternBetaald } from '../../lib/oudleiding';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';

// Friet voor iemand zonder account (lief, vriend, oudleiding zonder app): komt op geen drankfactuur.
// Drankteam houdt hier bij wie al betaald heeft.
export const ExternFriet = () => {
  const [bestellingen, setBestellingen] = useState([]);
  const [toonBetaald, setToonBetaald] = useState(false);
  const [bezig, setBezig] = useState(null);

  const laad = () =>
    fetchExterneFrietBestellingen()
      .then(setBestellingen)
      .catch(() => showToast('Bestellingen zonder account konden niet geladen worden', 'error'));

  useEffect(() => {
    laad();
  }, []);

  const open = useMemo(() => bestellingen.filter(b => !b.extern_betaald), [bestellingen]);
  const zichtbaar = toonBetaald ? bestellingen : open;
  const openBedrag = open.reduce((s, b) => s + Number(b.totaal_prijs || 0), 0);

  const wissel = async b => {
    setBezig(b.id);
    try {
      await zetExternBetaald(b.id, !b.extern_betaald);
      await laad();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBezig(null);
    }
  };

  return (
    <section
      aria-labelledby="extern-friet"
      className="bg-white dark:bg-[#1e2330] rounded-2xl border border-orange-200 dark:border-orange-900/50 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="extern-friet" className="font-bold text-gray-900 dark:text-white">
            Zonder account
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Friet voor iemand zonder app. Komt op geen drankfactuur: vink af wanneer betaald.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">Nog open</p>
          <p className={`font-black ${openBedrag > 0 ? 'text-orange-600' : 'text-gray-900 dark:text-white'}`}>
            {euro(openBedrag)}
          </p>
        </div>
      </div>

      {zichtbaar.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {toonBetaald ? 'Nog geen bestellingen zonder account.' : 'Alles is betaald.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {zichtbaar.map(b => (
            <li
              key={b.id}
              className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800"
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-900 dark:text-white">{b.extern_naam}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(b.items || []).map(i => `${i.quantity || 1} ${i.name}`).join(', ')}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {new Date(b.created_at).toLocaleDateString('nl-BE')} · besteld door{' '}
                  {b.besteller?.nickname || b.besteller?.naam || 'onbekend'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-bold text-sm">{euro(Number(b.totaal_prijs))}</span>
                <button
                  type="button"
                  onClick={() => wissel(b)}
                  disabled={bezig === b.id}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                    b.extern_betaald
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  }`}
                >
                  {b.extern_betaald ? 'Betaald' : 'Open'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {bestellingen.length > open.length && (
        <button
          type="button"
          onClick={() => setToonBetaald(!toonBetaald)}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400"
        >
          {toonBetaald ? 'Enkel open tonen' : `Ook betaalde tonen (${bestellingen.length - open.length})`}
        </button>
      )}
    </section>
  );
};
