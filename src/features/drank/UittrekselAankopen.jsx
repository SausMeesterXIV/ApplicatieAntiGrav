import React, { useRef, useState } from 'react';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import * as db from '../../lib/supabaseService';
import { euro } from '../../lib/geld';
import { koppelAankopen, leesBestand, parseCsv, uitgaandeVerrichtingen } from '../../lib/uittreksel';

// Aankoopfacturen uit een bankuittreksel (CSV uit de bank-app): uitgaande betalingen die bij een factuur horen
// zetten we op betaald, de andere kan je in één keer als nieuwe (betaalde) factuur toevoegen.
// Het bestand blijft op het toestel; enkel wat je aanvinkt gaat naar de database.

const datumTekst = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }) : '');

export const UittrekselAankopen = ({ facturen, periodes, standaardPeriode, onKlaar }) => {
  const invoer = useRef(null);
  const [resultaat, setResultaat] = useState(null);
  const [betalen, setBetalen] = useState([]); // factuur-id's
  const [nieuw, setNieuw] = useState({}); // index -> leverancier (aangevinkt)
  const [periodId, setPeriodId] = useState(standaardPeriode || '');
  const [bezig, setBezig] = useState(false);

  const lees = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const verrichtingen = uitgaandeVerrichtingen(parseCsv(await leesBestand(file)));
      if (!verrichtingen.length) return showToast('Geen uitgaande betalingen gevonden. Is het een CSV-export van de bank?', 'warning');
      const r = koppelAankopen(verrichtingen, facturen);
      setResultaat(r);
      setBetalen(r.teBetalen.filter(x => x.zeker).map(x => x.factuur.id));
      setNieuw({});
      setPeriodId(standaardPeriode || '');
    } catch (err) {
      console.error(err);
      showToast('Kon het bestand niet lezen. Is het een CSV-export van de bank?', 'error');
    }
  };

  const wisselBetalen = id => setBetalen(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const wisselNieuw = (i, v) =>
    setNieuw(p => {
      const n = { ...p };
      if (i in n) delete n[i];
      else n[i] = v.tegenpartij;
      return n;
    });

  const gekozenNieuw = Object.keys(nieuw).map(Number);
  const zonderNaam = gekozenNieuw.some(i => !nieuw[i].trim());
  const aantal = betalen.length + gekozenNieuw.length;

  const bevestig = async () => {
    if (!aantal || zonderNaam || (gekozenNieuw.length && !periodId)) return;
    setBezig(true);
    let gelukt = 0;
    try {
      for (const { factuur } of resultaat.teBetalen.filter(x => betalen.includes(x.factuur.id))) {
        await db.bewaarAankoopfactuur({ id: factuur.id, betaald: true });
        gelukt++;
      }
      for (const i of gekozenNieuw) {
        const v = resultaat.nieuw[i];
        await db.bewaarAankoopfactuur({
          period_id: periodId,
          leverancier: nieuw[i].trim().slice(0, 80),
          bedrag: v.bedrag,
          mededeling: v.mededeling || null,
          factuurdatum: v.datum,
          betaald: true,
          notitie: 'Uit bankuittreksel',
        });
        gelukt++;
      }
      showToast(`${gelukt} ${gelukt === 1 ? 'factuur' : 'facturen'} bijgewerkt`, 'success');
      setResultaat(null);
      onKlaar();
    } catch (err) {
      showToast(`${gelukt} gelukt, daarna liep het mis: ${err.message || 'onbekende fout'}`, 'error');
      onKlaar();
    } finally {
      setBezig(false);
    }
  };

  const vinkje = aan => (
    <span
      className={`material-icons-round text-2xl ${aan ? 'text-inkt dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}
      aria-hidden
    >
      {aan ? 'check_box' : 'check_box_outline_blank'}
    </span>
  );

  return (
    <>
      <input ref={invoer} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={lees} />
      <button
        type="button"
        disabled={!periodes.length}
        onClick={() => invoer.current?.click()}
        className="w-full rounded-2xl bg-kaart-event dark:bg-kaart-event-d py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
      >
        <span className="material-icons-round">account_balance</span> Uit bankuittreksel (CSV)
      </button>

      <BottomSheet
        isOpen={!!resultaat}
        onClose={() => setResultaat(null)}
        title="Bankuittreksel"
        subtitle={
          resultaat &&
          `${resultaat.teBetalen.length + resultaat.nieuw.length + resultaat.alInOrde} uitgaande betalingen` +
            (resultaat.alInOrde ? ` · ${resultaat.alInOrde} al in orde` : '')
        }
      >
        {resultaat && (
          <div className="space-y-5 pb-2">
            {resultaat.teBetalen.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">Op betaald zetten</p>
                <div className="rounded-2xl bg-kaart-event dark:bg-white/10 divide-y divide-white dark:divide-white/5 overflow-hidden">
                  {resultaat.teBetalen.map(({ factuur, verrichting, zeker }) => (
                    <button
                      key={factuur.id}
                      type="button"
                      onClick={() => wisselBetalen(factuur.id)}
                      aria-pressed={betalen.includes(factuur.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    >
                      {vinkje(betalen.includes(factuur.id))}
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold truncate">{factuur.leverancier}</span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                          betaald {datumTekst(verrichting.datum)}
                          {verrichting.tegenpartij && verrichting.tegenpartij !== factuur.leverancier ? ` aan ${verrichting.tegenpartij}` : ''}
                        </span>
                        {!zeker && (
                          <span className="block text-xs font-semibold text-orange-600 dark:text-orange-400">
                            Enkel het bedrag klopt, kijk even na
                          </span>
                        )}
                      </span>
                      <span className="font-extrabold tabular-nums">{euro(factuur.bedrag)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {resultaat.nieuw.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                  Nieuwe factuur toevoegen
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Deze betalingen horen bij geen enkele factuur. Vink aan wat een aankoop was; die komt erbij als betaald.
                </p>
                <div className="rounded-2xl bg-kaart-event dark:bg-white/10 divide-y divide-white dark:divide-white/5 overflow-hidden">
                  {resultaat.nieuw.map((v, i) => {
                    const aan = i in nieuw;
                    return (
                      <div key={i} className="px-4 py-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => wisselNieuw(i, v)}
                          aria-pressed={aan}
                          className="w-full flex items-center gap-3 text-left"
                        >
                          {vinkje(aan)}
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold truncate">{v.tegenpartij || 'Onbekende ontvanger'}</span>
                            <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                              {datumTekst(v.datum)}
                              {v.mededeling ? ` · ${v.mededeling}` : ''}
                            </span>
                          </span>
                          <span className="font-extrabold tabular-nums">{euro(v.bedrag)}</span>
                        </button>
                        {aan && (
                          <input
                            value={nieuw[i]}
                            onChange={e => setNieuw(p => ({ ...p, [i]: e.target.value }))}
                            placeholder="Leverancier"
                            maxLength={80}
                            aria-label="Leverancier"
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-white/10 border-0 text-base focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {gekozenNieuw.length > 0 && (
                  <label className="block">
                    <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2">
                      Periode voor de nieuwe facturen
                    </span>
                    <select
                      value={periodId}
                      onChange={e => setPeriodId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-kaart-event dark:bg-white/10 border-0 text-base"
                    >
                      {periodes.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.naam}
                          {p.is_closed ? '' : ' (lopend)'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            )}

            {!resultaat.teBetalen.length && !resultaat.nieuw.length && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                Alle uitgaande betalingen in dit bestand staan al als betaald in de lijst.
              </p>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Het bestand wordt niet opgeslagen. Een foto van de factuur voeg je daarna toe door op de factuur te tikken.
            </p>

            <button
              type="button"
              onClick={bevestig}
              disabled={bezig || !aantal || zonderNaam}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold disabled:opacity-40"
            >
              {bezig ? 'Bezig…' : zonderNaam ? 'Vul de leverancier in' : `${aantal || 'Niets'} ${aantal === 1 ? 'factuur' : 'facturen'} bewaren`}
            </button>
          </div>
        )}
      </BottomSheet>
    </>
  );
};
